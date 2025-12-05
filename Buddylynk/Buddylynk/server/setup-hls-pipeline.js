/**
 * AWS HLS Pipeline Setup Script
 * Run once: node setup-hls-pipeline.js
 */

const { S3Client, CreateBucketCommand, PutBucketCorsCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
const { IAMClient, CreateRoleCommand, PutRolePolicyCommand, GetRoleCommand } = require('@aws-sdk/client-iam');
const { MediaConvertClient, DescribeEndpointsCommand } = require('@aws-sdk/client-mediaconvert');
const { CloudFrontClient, CreateDistributionCommand } = require('@aws-sdk/client-cloudfront');
const fs = require('fs');
require('dotenv').config();

const REGION = process.env.AWS_REGION || 'us-east-1';
const INPUT_BUCKET = process.env.S3_BUCKET_NAME;
const OUTPUT_BUCKET = `${INPUT_BUCKET}-hls`;
const ROLE_NAME = 'BuddylynkMediaConvertRole';

const s3 = new S3Client({ region: REGION });
const iam = new IAMClient({ region: REGION });
const cf = new CloudFrontClient({ region: 'us-east-1' });

async function setup() {
    console.log('🚀 Setting up HLS Video Streaming Pipeline\n');
    console.log(`   Input Bucket:  ${INPUT_BUCKET}`);
    console.log(`   Output Bucket: ${OUTPUT_BUCKET}`);
    console.log(`   Region:        ${REGION}\n`);

    // 1. Create HLS output bucket
    console.log('📦 Step 1: Creating HLS output bucket...');
    try {
        const createParams = REGION === 'us-east-1' 
            ? { Bucket: OUTPUT_BUCKET }
            : { Bucket: OUTPUT_BUCKET, CreateBucketConfiguration: { LocationConstraint: REGION } };
        await s3.send(new CreateBucketCommand(createParams));
        console.log('   ✅ Bucket created');
    } catch (e) {
        if (e.name === 'BucketAlreadyOwnedByYou') console.log('   ✅ Bucket exists');
        else throw e;
    }

    // CORS for HLS streaming
    await s3.send(new PutBucketCorsCommand({
        Bucket: OUTPUT_BUCKET,
        CORSConfiguration: {
            CORSRules: [{
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'HEAD'],
                AllowedOrigins: ['*'],
                MaxAgeSeconds: 86400,
            }],
        },
    }));
    console.log('   ✅ CORS configured');

    // Public read policy
    await s3.send(new PutBucketPolicyCommand({
        Bucket: OUTPUT_BUCKET,
        Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
                Sid: 'PublicRead',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::${OUTPUT_BUCKET}/*`,
            }],
        }),
    }));
    console.log('   ✅ Public access enabled');

    // 2. Create IAM Role for MediaConvert
    console.log('\n🔐 Step 2: Creating MediaConvert IAM role...');
    let roleArn;
    try {
        await iam.send(new CreateRoleCommand({
            RoleName: ROLE_NAME,
            AssumeRolePolicyDocument: JSON.stringify({
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Principal: { Service: 'mediaconvert.amazonaws.com' },
                    Action: 'sts:AssumeRole',
                }],
            }),
        }));
        console.log('   ✅ Role created');
    } catch (e) {
        if (e.name === 'EntityAlreadyExistsException') console.log('   ✅ Role exists');
        else throw e;
    }

    // Attach S3 permissions
    await iam.send(new PutRolePolicyCommand({
        RoleName: ROLE_NAME,
        PolicyName: 'S3Access',
        PolicyDocument: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
                Effect: 'Allow',
                Action: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
                Resource: [
                    `arn:aws:s3:::${INPUT_BUCKET}`, `arn:aws:s3:::${INPUT_BUCKET}/*`,
                    `arn:aws:s3:::${OUTPUT_BUCKET}`, `arn:aws:s3:::${OUTPUT_BUCKET}/*`,
                ],
            }],
        }),
    }));
    console.log('   ✅ S3 permissions attached');

    const roleResp = await iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }));
    roleArn = roleResp.Role.Arn;

    // 3. Get MediaConvert endpoint
    console.log('\n🎬 Step 3: Getting MediaConvert endpoint...');
    const mc = new MediaConvertClient({ region: REGION });
    const endpoints = await mc.send(new DescribeEndpointsCommand({}));
    const mcEndpoint = endpoints.Endpoints[0].Url;
    console.log(`   ✅ Endpoint: ${mcEndpoint}`);

    // 4. Create CloudFront distribution
    console.log('\n🌐 Step 4: Creating CloudFront distribution...');
    let cfDomain = null;
    try {
        const cfResp = await cf.send(new CreateDistributionCommand({
            DistributionConfig: {
                CallerReference: `buddylynk-hls-${Date.now()}`,
                Comment: 'Buddylynk HLS CDN',
                Enabled: true,
                DefaultCacheBehavior: {
                    TargetOriginId: `S3-${OUTPUT_BUCKET}`,
                    ViewerProtocolPolicy: 'redirect-to-https',
                    AllowedMethods: { Quantity: 2, Items: ['GET', 'HEAD'], CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] } },
                    ForwardedValues: { QueryString: false, Cookies: { Forward: 'none' }, Headers: { Quantity: 0 } },
                    MinTTL: 0, DefaultTTL: 86400, MaxTTL: 31536000, Compress: true,
                },
                Origins: {
                    Quantity: 1,
                    Items: [{
                        Id: `S3-${OUTPUT_BUCKET}`,
                        DomainName: `${OUTPUT_BUCKET}.s3.${REGION}.amazonaws.com`,
                        S3OriginConfig: { OriginAccessIdentity: '' },
                    }],
                },
                PriceClass: 'PriceClass_All',
            },
        }));
        cfDomain = cfResp.Distribution.DomainName;
        console.log(`   ✅ CloudFront: https://${cfDomain}`);
    } catch (e) {
        console.log(`   ⚠️  CloudFront skipped: ${e.message}`);
    }

    // 5. Save config
    console.log('\n💾 Step 5: Saving configuration...');
    const config = `
# HLS Video Streaming Config (add to .env)
HLS_OUTPUT_BUCKET=${OUTPUT_BUCKET}
MEDIACONVERT_ENDPOINT=${mcEndpoint}
MEDIACONVERT_ROLE_ARN=${roleArn}
CLOUDFRONT_HLS_DOMAIN=${cfDomain || ''}
`;
    
    // Append to .env
    fs.appendFileSync('.env', config);
    console.log('   ✅ Added to .env');

    console.log('\n' + '='.repeat(50));
    console.log('✅ HLS PIPELINE READY!');
    console.log('='.repeat(50));
    console.log('\nVideos will auto-convert to HLS when uploaded.');
    console.log('HLS streams: 360p, 720p, 1080p adaptive bitrate');
    console.log(`CDN URL: https://${cfDomain || OUTPUT_BUCKET + '.s3.' + REGION + '.amazonaws.com'}`);
}

setup().catch(e => { console.error('❌ Setup failed:', e.message); process.exit(1); });
