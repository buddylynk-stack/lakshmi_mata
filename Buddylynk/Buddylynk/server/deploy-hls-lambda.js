/**
 * Deploy HLS Lambda Function with S3 Trigger
 * Run: node deploy-hls-lambda.js
 */

const { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, AddPermissionCommand, GetFunctionCommand } = require('@aws-sdk/client-lambda');
const { IAMClient, CreateRoleCommand, PutRolePolicyCommand, GetRoleCommand, AttachRolePolicyCommand } = require('@aws-sdk/client-iam');
const { S3Client, PutBucketNotificationConfigurationCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const REGION = process.env.AWS_REGION || 'us-east-1';
const INPUT_BUCKET = process.env.S3_BUCKET_NAME;
const OUTPUT_BUCKET = process.env.HLS_OUTPUT_BUCKET || `${INPUT_BUCKET}-hls`;
const MEDIACONVERT_ENDPOINT = process.env.MEDIACONVERT_ENDPOINT;
const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN;
const LAMBDA_NAME = 'BuddylynkHLSTranscoder';
const LAMBDA_ROLE_NAME = 'BuddylynkLambdaHLSRole';

const lambda = new LambdaClient({ region: REGION });
const iam = new IAMClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

async function createLambdaRole() {
    console.log('🔐 Creating Lambda execution role...');
    
    const trustPolicy = {
        Version: '2012-10-17',
        Statement: [{
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
        }],
    };

    try {
        await iam.send(new CreateRoleCommand({
            RoleName: LAMBDA_ROLE_NAME,
            AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        }));
        console.log('   ✅ Role created');
    } catch (e) {
        if (e.name === 'EntityAlreadyExistsException') {
            console.log('   ✅ Role exists');
        } else throw e;
    }

    // Attach basic Lambda execution policy
    try {
        await iam.send(new AttachRolePolicyCommand({
            RoleName: LAMBDA_ROLE_NAME,
            PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        }));
    } catch (e) { /* Already attached */ }

    // Add S3 and MediaConvert permissions
    const policy = {
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: ['s3:GetObject', 's3:PutObject'],
                Resource: [`arn:aws:s3:::${INPUT_BUCKET}/*`, `arn:aws:s3:::${OUTPUT_BUCKET}/*`],
            },
            {
                Effect: 'Allow',
                Action: ['mediaconvert:CreateJob', 'mediaconvert:DescribeEndpoints'],
                Resource: '*',
            },
            {
                Effect: 'Allow',
                Action: 'iam:PassRole',
                Resource: MEDIACONVERT_ROLE_ARN,
            },
        ],
    };

    await iam.send(new PutRolePolicyCommand({
        RoleName: LAMBDA_ROLE_NAME,
        PolicyName: 'HLSTranscoderPolicy',
        PolicyDocument: JSON.stringify(policy),
    }));
    console.log('   ✅ Permissions attached');

    const roleResp = await iam.send(new GetRoleCommand({ RoleName: LAMBDA_ROLE_NAME }));
    return roleResp.Role.Arn;
}

async function packageLambda() {
    console.log('📦 Packaging Lambda function...');
    const lambdaDir = path.join(__dirname, 'lambda-hls');
    const zipPath = path.join(__dirname, 'lambda-hls.zip');

    // Create zip
    process.chdir(lambdaDir);
    execSync('npm install --production', { stdio: 'inherit' });
    
    // Use PowerShell to create zip on Windows
    const isWindows = process.platform === 'win32';
    if (isWindows) {
        execSync(`powershell Compress-Archive -Path * -DestinationPath "${zipPath}" -Force`, { stdio: 'inherit' });
    } else {
        execSync(`zip -r "${zipPath}" .`, { stdio: 'inherit' });
    }
    
    process.chdir(__dirname);
    console.log('   ✅ Lambda packaged');
    return fs.readFileSync(zipPath);
}

async function deployLambda(roleArn, zipBuffer) {
    console.log('🚀 Deploying Lambda function...');

    const envVars = {
        AWS_REGION: REGION,
        MEDIACONVERT_ENDPOINT: MEDIACONVERT_ENDPOINT,
        MEDIACONVERT_ROLE_ARN: MEDIACONVERT_ROLE_ARN,
        HLS_OUTPUT_BUCKET: OUTPUT_BUCKET,
    };

    try {
        // Try to get existing function
        await lambda.send(new GetFunctionCommand({ FunctionName: LAMBDA_NAME }));
        
        // Update existing
        await lambda.send(new UpdateFunctionCodeCommand({
            FunctionName: LAMBDA_NAME,
            ZipFile: zipBuffer,
        }));
        console.log('   ✅ Lambda updated');
    } catch (e) {
        if (e.name === 'ResourceNotFoundException') {
            // Create new
            await lambda.send(new CreateFunctionCommand({
                FunctionName: LAMBDA_NAME,
                Runtime: 'nodejs20.x',
                Role: roleArn,
                Handler: 'index.handler',
                Code: { ZipFile: zipBuffer },
                Timeout: 60,
                MemorySize: 256,
                Environment: { Variables: envVars },
            }));
            console.log('   ✅ Lambda created');
        } else throw e;
    }
}

async function setupS3Trigger() {
    console.log('🔗 Setting up S3 trigger...');

    // Get AWS account ID from role ARN
    const roleResp = await iam.send(new GetRoleCommand({ RoleName: LAMBDA_ROLE_NAME }));
    const accountId = roleResp.Role.Arn.split(':')[4];
    const lambdaArn = `arn:aws:lambda:${REGION}:${accountId}:function:${LAMBDA_NAME}`;

    // Add permission for S3 to invoke Lambda
    try {
        await lambda.send(new AddPermissionCommand({
            FunctionName: LAMBDA_NAME,
            StatementId: 'S3InvokePermission',
            Action: 'lambda:InvokeFunction',
            Principal: 's3.amazonaws.com',
            SourceArn: `arn:aws:s3:::${INPUT_BUCKET}`,
        }));
    } catch (e) {
        if (!e.message?.includes('already exists')) throw e;
    }

    // Configure S3 bucket notification
    await s3.send(new PutBucketNotificationConfigurationCommand({
        Bucket: INPUT_BUCKET,
        NotificationConfiguration: {
            LambdaFunctionConfigurations: [{
                LambdaFunctionArn: lambdaArn,
                Events: ['s3:ObjectCreated:*'],
                Filter: {
                    Key: {
                        FilterRules: [
                            { Name: 'suffix', Value: '.mp4' },
                        ],
                    },
                },
            }],
        },
    }));
    console.log('   ✅ S3 trigger configured');
}

async function main() {
    console.log('\n🎬 Deploying HLS Lambda Transcoder\n');
    console.log(`   Input Bucket:  ${INPUT_BUCKET}`);
    console.log(`   Output Bucket: ${OUTPUT_BUCKET}`);
    console.log(`   Region:        ${REGION}\n`);

    if (!MEDIACONVERT_ENDPOINT || !MEDIACONVERT_ROLE_ARN) {
        console.error('❌ Run setup-hls-pipeline.js first to get MEDIACONVERT_ENDPOINT and MEDIACONVERT_ROLE_ARN');
        process.exit(1);
    }

    const roleArn = await createLambdaRole();
    
    // Wait for role to propagate
    console.log('⏳ Waiting 10s for IAM role propagation...');
    await new Promise(r => setTimeout(r, 10000));

    const zipBuffer = await packageLambda();
    await deployLambda(roleArn, zipBuffer);
    await setupS3Trigger();

    console.log('\n✅ HLS Lambda deployed successfully!');
    console.log('   Videos uploaded to S3 will auto-convert to HLS');
}

main().catch(e => { console.error('❌ Deploy failed:', e.message); process.exit(1); });
