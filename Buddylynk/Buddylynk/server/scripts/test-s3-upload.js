#!/usr/bin/env node

/**
 * Test S3 Upload & Access
 * 
 * This script tests if S3 uploads work and are publicly accessible
 * Run: node scripts/test-s3-upload.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, BUCKET_NAME } = require("../config/s3");

const testS3Upload = async () => {
    console.log('\n🧪 Testing S3 Upload & Public Access...\n');
    console.log(`📦 Bucket: ${BUCKET_NAME}\n`);

    const testKey = `test-${Date.now()}.txt`;
    const testContent = 'This is a test file to verify S3 public access works!';

    try {
        // Step 1: Upload test file
        console.log('1️⃣  Uploading test file...');
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: testKey,
            Body: testContent,
            ContentType: 'text/plain',
            ACL: 'public-read', // This is the key fix!
        }));
        console.log(`   ✅ Uploaded: ${testKey}\n`);

        // Step 2: Generate public URL
        const publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${testKey}`;
        console.log('2️⃣  Public URL generated:');
        console.log(`   ${publicUrl}\n`);

        // Step 3: Test public access via HTTP
        console.log('3️⃣  Testing public access via HTTP...');
        const https = require('https');
        
        await new Promise((resolve, reject) => {
            https.get(publicUrl, (res) => {
                if (res.statusCode === 200) {
                    console.log(`   ✅ HTTP Status: ${res.statusCode} OK`);
                    console.log(`   ✅ File is publicly accessible!\n`);
                    resolve();
                } else {
                    console.log(`   ❌ HTTP Status: ${res.statusCode}`);
                    console.log(`   ❌ File is NOT publicly accessible\n`);
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            }).on('error', reject);
        });

        // Step 4: Cleanup
        console.log('4️⃣  Cleaning up test file...');
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: testKey,
        }));
        console.log('   ✅ Test file deleted\n');

        // Success!
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║              ✅ ALL TESTS PASSED!                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        console.log('Your S3 bucket is working correctly:');
        console.log('  ✓ Uploads work');
        console.log('  ✓ Files are publicly accessible');
        console.log('  ✓ ACL is set correctly');
        console.log('  ✓ Avatar images will load without errors\n');

    } catch (err) {
        console.error('\n╔════════════════════════════════════════════════════════════╗');
        console.error('║                  ❌ TEST FAILED                            ║');
        console.error('╚════════════════════════════════════════════════════════════╝\n');
        console.error('Error:', err.message);
        console.error('\n🔍 Troubleshooting:');
        console.error('  1. Run: node scripts/setup-s3-complete.js');
        console.error('  2. Check AWS credentials in .env');
        console.error('  3. Verify bucket permissions in AWS Console\n');
        process.exit(1);
    }
};

testS3Upload();
