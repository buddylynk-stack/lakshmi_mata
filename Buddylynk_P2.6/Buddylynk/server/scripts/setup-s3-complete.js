#!/usr/bin/env node

/**
 * Complete S3 Setup Script
 * 
 * This script configures your S3 bucket for public image hosting:
 * 1. Disables public access blocks
 * 2. Sets bucket policy for public read access
 * 3. Configures CORS for browser access
 * 4. Tests the configuration
 * 
 * Run: node scripts/setup-s3-complete.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { 
    PutBucketPolicyCommand, 
    PutPublicAccessBlockCommand, 
    PutBucketCorsCommand,
    GetBucketPolicyCommand,
    GetBucketCorsCommand
} = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const setupS3Complete = async () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         S3 BUCKET COMPLETE SETUP & CONFIGURATION          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (!BUCKET_NAME) {
        console.error('❌ ERROR: S3_BUCKET_NAME not found in .env file\n');
        process.exit(1);
    }

    console.log(`📦 Bucket: ${BUCKET_NAME}\n`);

    try {
        // Step 1: Disable block public access
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 1: Disabling Public Access Blocks                 │');
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

        // Step 2: Set bucket policy
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 2: Setting Bucket Policy (Public Read Access)     │');
        console.log('└─────────────────────────────────────────────────────────┘');
        
        const bucketPolicy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Sid: "PublicReadGetObject",
                    Effect: "Allow",
                    Principal: "*",
                    Action: "s3:GetObject",
                    Resource: `arn:aws:s3:::${BUCKET_NAME}/*`
                }
            ]
        };

        await s3Client.send(new PutBucketPolicyCommand({
            Bucket: BUCKET_NAME,
            Policy: JSON.stringify(bucketPolicy)
        }));
        console.log('✅ Bucket policy configured for public read\n');

        // Step 3: Configure CORS
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 3: Configuring CORS (Browser Access)              │');
        console.log('└─────────────────────────────────────────────────────────┘');
        
        const corsConfiguration = {
            CORSRules: [
                {
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["GET", "HEAD", "PUT", "POST"],
                    AllowedOrigins: ["*"],
                    ExposeHeaders: ["ETag", "x-amz-request-id"],
                    MaxAgeSeconds: 3600
                }
            ]
        };

        await s3Client.send(new PutBucketCorsCommand({
            Bucket: BUCKET_NAME,
            CORSConfiguration: corsConfiguration
        }));
        console.log('✅ CORS policy configured\n');

        // Step 4: Verify configuration
        console.log('┌─────────────────────────────────────────────────────────┐');
        console.log('│ STEP 4: Verifying Configuration                        │');
        console.log('└─────────────────────────────────────────────────────────┘');

        try {
            const policyResult = await s3Client.send(new GetBucketPolicyCommand({
                Bucket: BUCKET_NAME
            }));
            console.log('✅ Bucket policy verified');
        } catch (err) {
            console.log('⚠️  Could not verify bucket policy:', err.message);
        }

        try {
            const corsResult = await s3Client.send(new GetBucketCorsCommand({
                Bucket: BUCKET_NAME
            }));
            console.log('✅ CORS configuration verified\n');
        } catch (err) {
            console.log('⚠️  Could not verify CORS:', err.message);
        }

        // Success summary
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ SETUP COMPLETE!                      ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        console.log('Your S3 bucket is now configured with:');
        console.log('  ✓ Public read access enabled');
        console.log('  ✓ CORS configured for browser access');
        console.log('  ✓ All new uploads will be publicly accessible');
        console.log('  ✓ Images will load without 403 errors\n');
        
        console.log('📝 Next Steps:');
        console.log('  1. Restart your server to apply changes');
        console.log('  2. Upload a new profile picture to test');
        console.log('  3. Check browser console for any remaining errors\n');
        
        console.log('🔗 Test URL format:');
        console.log(`   https://${BUCKET_NAME}.s3.amazonaws.com/[your-image-key]\n`);

    } catch (err) {
        console.error('\n╔════════════════════════════════════════════════════════════╗');
        console.error('║                    ❌ SETUP FAILED                         ║');
        console.error('╚════════════════════════════════════════════════════════════╝\n');
        console.error('Error:', err.message);
        console.error('\n🔍 Troubleshooting:');
        console.error('  1. Check AWS credentials in .env file');
        console.error('  2. Verify IAM user has these permissions:');
        console.error('     - s3:PutBucketPolicy');
        console.error('     - s3:PutBucketPublicAccessBlock');
        console.error('     - s3:PutBucketCors');
        console.error('  3. Ensure bucket name is correct');
        console.error('  4. Check AWS region matches your bucket\n');
        process.exit(1);
    }
};

// Run the setup
setupS3Complete();
