/**
 * Setup S3 bucket for public read access
 * Run this once: node setup-s3-public-access.js
 */

require('dotenv').config();
const { S3Client, PutBucketPolicyCommand, PutPublicAccessBlockCommand, GetBucketPolicyCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

async function setupPublicAccess() {
    console.log('\n========================================');
    console.log('🪣 S3 PUBLIC ACCESS SETUP');
    console.log('========================================\n');
    
    if (!BUCKET_NAME) {
        console.error('❌ S3_BUCKET_NAME not set in .env file!');
        process.exit(1);
    }
    
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('❌ AWS credentials not set in .env file!');
        process.exit(1);
    }
    
    console.log(`📦 Bucket: ${BUCKET_NAME}`);
    console.log(`🌍 Region: ${process.env.AWS_REGION || 'us-east-1'}\n`);
    
    try {
        // Step 0: Verify bucket exists
        console.log('Step 0: Verifying bucket exists...');
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
        console.log('✅ Bucket exists and accessible\n');
        
        // Step 1: Disable block public access
        console.log('Step 1: Disabling block public access...');
        const blockCommand = new PutPublicAccessBlockCommand({
            Bucket: BUCKET_NAME,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: false,
                IgnorePublicAcls: false,
                BlockPublicPolicy: false,
                RestrictPublicBuckets: false
            }
        });
        await s3Client.send(blockCommand);
        console.log('✅ Block public access disabled\n');
        
        // Step 2: Set bucket policy for public read
        console.log('Step 2: Setting bucket policy for public read...');
        const bucketPolicy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Sid: 'PublicReadGetObject',
                    Effect: 'Allow',
                    Principal: '*',
                    Action: 's3:GetObject',
                    Resource: `arn:aws:s3:::${BUCKET_NAME}/*`
                }
            ]
        };
        
        const policyCommand = new PutBucketPolicyCommand({
            Bucket: BUCKET_NAME,
            Policy: JSON.stringify(bucketPolicy)
        });
        await s3Client.send(policyCommand);
        console.log('✅ Bucket policy set for public read\n');
        
        // Step 3: Verify policy
        console.log('Step 3: Verifying policy...');
        const getPolicy = await s3Client.send(new GetBucketPolicyCommand({ Bucket: BUCKET_NAME }));
        console.log('✅ Policy verified:', JSON.parse(getPolicy.Policy).Statement[0].Sid);
        
        console.log('\n========================================');
        console.log('🎉 SUCCESS! S3 bucket is now PUBLIC');
        console.log('========================================');
        console.log(`\nTest URL: https://${BUCKET_NAME}.s3.amazonaws.com/`);
        console.log('All uploaded media files will be publicly accessible.\n');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        
        if (error.name === 'NotFound' || error.Code === 'NoSuchBucket') {
            console.error(`\n⚠️  Bucket "${BUCKET_NAME}" does not exist!`);
            console.error('Create the bucket first in AWS Console.\n');
        } else if (error.name === 'AccessDenied') {
            console.error('\n⚠️  Access Denied! Check your AWS credentials.');
            console.error('Make sure your IAM user has s3:PutBucketPolicy permission.\n');
        } else {
            console.error('\nFull error:', error);
        }
        
        process.exit(1);
    }
}

setupPublicAccess();
