#!/usr/bin/env node

/**
 * Enable Bucket ACLs
 * 
 * AWS S3 buckets created after April 2023 have ACLs disabled by default.
 * This script enables ACLs so we can set public-read on individual objects.
 * 
 * Run: node scripts/enable-bucket-acls.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PutBucketOwnershipControlsCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const enableBucketACLs = async () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ENABLE BUCKET ACLs                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (!BUCKET_NAME) {
        console.error('❌ ERROR: S3_BUCKET_NAME not found in .env file\n');
        process.exit(1);
    }

    console.log(`📦 Bucket: ${BUCKET_NAME}\n`);

    try {
        console.log('🔧 Enabling ACLs on bucket...');
        console.log('   (This allows setting public-read on individual files)\n');

        await s3Client.send(new PutBucketOwnershipControlsCommand({
            Bucket: BUCKET_NAME,
            OwnershipControls: {
                Rules: [
                    {
                        ObjectOwnership: 'BucketOwnerPreferred'
                    }
                ]
            }
        }));

        console.log('✅ ACLs enabled successfully!\n');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ SUCCESS!                             ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        console.log('Your bucket now supports ACLs.');
        console.log('You can now upload files with public-read ACL.\n');
        console.log('📝 Next: Run node scripts/setup-s3-complete.js\n');

    } catch (err) {
        console.error('\n╔════════════════════════════════════════════════════════════╗');
        console.error('║                    ❌ FAILED                               ║');
        console.error('╚════════════════════════════════════════════════════════════╝\n');
        console.error('Error:', err.message);
        console.error('\n🔍 Troubleshooting:');
        console.error('  1. Check AWS credentials in .env');
        console.error('  2. Verify IAM user has s3:PutBucketOwnershipControls permission');
        console.error('  3. You may need to do this in AWS Console instead:\n');
        console.error('     a. Go to S3 Console');
        console.error('     b. Select your bucket');
        console.error('     c. Go to Permissions tab');
        console.error('     d. Edit "Object Ownership"');
        console.error('     e. Select "ACLs enabled" and "Bucket owner preferred"\n');
        process.exit(1);
    }
};

enableBucketACLs();
