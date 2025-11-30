#!/usr/bin/env node

/**
 * 🔧 FIX S3 IMAGES - ALL-IN-ONE SOLUTION
 * 
 * This script fixes all S3 image loading issues permanently:
 * 1. Enables ACLs on bucket
 * 2. Configures public access
 * 3. Sets bucket policy
 * 4. Configures CORS
 * 5. Tests the configuration
 * 
 * Run: node scripts/fix-s3-images.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { 
    PutBucketOwnershipControlsCommand,
    PutBucketPolicyCommand, 
    PutPublicAccessBlockCommand, 
    PutBucketCorsCommand,
    GetBucketPolicyCommand,
    GetBucketCorsCommand,
    PutObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fixS3Images = async () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         🔧 FIX S3 IMAGES - ALL-IN-ONE SOLUTION            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (!BUCKET_NAME) {
        console.error('❌ ERROR: S3_BUCKET_NAME not found in .env file\n');
        process.exit(1);
    }

    console.log(`📦 Bucket: ${BUCKET_NAME}\n`);

    try {
        // STEP 1: Enable ACLs
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 1/6: Enabling ACLs on Bucket                      │');
        console.log('└─────────────────────────────────────────────────────────┘');
        
        await s3Client.send(new PutBucketOwnershipControlsCommand({
            Bucket: BUCKET_NAME,
            OwnershipControls: {
                Rules: [{ ObjectOwnership: 'BucketOwnerPreferred' }]
            }
        }));
        console.log('✅ ACLs enabled\n');
        await sleep(1000);

        // STEP 2: Disable public access blocks
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 2/6: Disabling Public Access Blocks               │');
        console.log('└─────────────────────────────────────────────────────────┘');
        
        await s3Client.send(new PutPublicAccessBlockCommand({
            Bucket: BUCKET_NAME,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: false,
                IgnorePublicAcls: false,
                BlockPublicPolicy: false,
                RestrictPublicBuckets: false
            }
        }));
        console.log('✅ Public access blocks disabled\n');
        await sleep(1000);

        // STEP 3: Set bucket policy
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 3/6: Setting Bucket Policy (Public Read)          │');
        console.log('└─────────────────────────────────────────────────────────┘');
        
        const bucketPolicy = {
            Version: "2012-10-17",
            Statement: [{
                Sid: "PublicReadGetObject",
                Effect: "Allow",
                Principal: "*",
                Action: "s3:GetObject",
                Resource: `arn:aws:s3:::${BUCKET_NAME}/*`
            }]
        };

        await s3Client.send(new PutBucketPolicyCommand({
            Bucket: BUCKET_NAME,
            Policy: JSON.stringify(bucketPolicy)
        }));
        console.log('✅ Bucket policy configured\n');
        await sleep(1000);

        // STEP 4: Configure CORS
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 4/6: Configuring CORS (Browser Access)            │');
        console.log('└─────────────────────────────────────────────────────────┘');
        
        const corsConfiguration = {
            CORSRules: [{
                AllowedHeaders: ["*"],
                AllowedMethods: ["GET", "HEAD", "PUT", "POST"],
                AllowedOrigins: ["*"],
                ExposeHeaders: ["ETag", "x-amz-request-id"],
                MaxAgeSeconds: 3600
            }]
        };

        await s3Client.send(new PutBucketCorsCommand({
            Bucket: BUCKET_NAME,
            CORSConfiguration: corsConfiguration
        }));
        console.log('✅ CORS configured\n');
        await sleep(1000);

        // STEP 5: Verify configuration
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 5/6: Verifying Configuration                      │');
        console.log('└─────────────────────────────────────────────────────────┘');

        await s3Client.send(new GetBucketPolicyCommand({ Bucket: BUCKET_NAME }));
        console.log('✅ Bucket policy verified');

        await s3Client.send(new GetBucketCorsCommand({ Bucket: BUCKET_NAME }));
        console.log('✅ CORS verified\n');
        await sleep(1000);

        // STEP 6: Test upload
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 6/6: Testing Upload & Public Access               │');
        console.log('└─────────────────────────────────────────────────────────┘');

        const testKey = `test-${Date.now()}.txt`;
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: testKey,
            Body: 'Test file',
            ContentType: 'text/plain',
            ACL: 'public-read',
        }));
        console.log('✅ Test file uploaded');

        const publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${testKey}`;
        const https = require('https');
        
        await new Promise((resolve, reject) => {
            https.get(publicUrl, (res) => {
                if (res.statusCode === 200) {
                    console.log('✅ Public access verified (HTTP 200)');
                    resolve();
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            }).on('error', reject);
        });

        await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: testKey,
        }));
        console.log('✅ Test file cleaned up\n');

        // SUCCESS!
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║              ✅ ALL FIXES APPLIED SUCCESSFULLY!            ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        console.log('🎉 Your S3 bucket is now fully configured:\n');
        console.log('  ✓ ACLs enabled for public-read uploads');
        console.log('  ✓ Public access blocks disabled');
        console.log('  ✓ Bucket policy allows public read');
        console.log('  ✓ CORS configured for browser access');
        console.log('  ✓ Upload test passed');
        console.log('  ✓ Public access test passed\n');
        
        console.log('📝 Next Steps:\n');
        console.log('  1. Restart your server');
        console.log('  2. Upload a new profile picture');
        console.log('  3. Images will now load without 403 errors!\n');
        
        console.log('💡 All future uploads will be publicly accessible automatically.\n');

    } catch (err) {
        console.error('\n╔════════════════════════════════════════════════════════════╗');
        console.error('║                    ❌ FIX FAILED                           ║');
        console.error('╚════════════════════════════════════════════════════════════╝\n');
        console.error('Error:', err.message);
        console.error('\n🔍 Troubleshooting:\n');
        console.error('  1. Check AWS credentials in .env file');
        console.error('  2. Verify IAM user has these permissions:');
        console.error('     - s3:PutBucketOwnershipControls');
        console.error('     - s3:PutBucketPolicy');
        console.error('     - s3:PutBucketPublicAccessBlock');
        console.error('     - s3:PutBucketCors');
        console.error('  3. Ensure bucket name is correct');
        console.error('  4. Check AWS region matches your bucket\n');
        console.error('📖 Manual fix: See S3_IMAGE_FIX.md for AWS Console steps\n');
        process.exit(1);
    }
};

fixS3Images();
