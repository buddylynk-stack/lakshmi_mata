// Test S3 Configuration
// Run this to check if your S3 bucket is properly configured
// Usage: node test-s3-config.js

require('dotenv').config({ path: './Buddylynk/server/.env' });
const { S3Client, GetBucketCorsCommand, GetBucketPolicyCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

async function testS3Config() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  S3 Bucket Configuration Test');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('Bucket:', BUCKET_NAME);
    console.log('Region:', process.env.AWS_REGION || 'us-east-1');
    console.log('\n');

    // Test 1: Check CORS
    console.log('📋 Test 1: Checking CORS Configuration...');
    try {
        const corsCommand = new GetBucketCorsCommand({ Bucket: BUCKET_NAME });
        const corsResponse = await s3Client.send(corsCommand);
        
        if (corsResponse.CORSRules && corsResponse.CORSRules.length > 0) {
            console.log('✅ CORS is configured!');
            console.log('   Rules:', JSON.stringify(corsResponse.CORSRules, null, 2));
        } else {
            console.log('⚠️  CORS is configured but has no rules');
        }
    } catch (error) {
        if (error.name === 'NoSuchCORSConfiguration') {
            console.log('❌ CORS is NOT configured!');
            console.log('   This is likely causing your 400 error.');
            console.log('   Follow AWS-CONSOLE-STEPS.md to configure CORS.');
        } else {
            console.log('❌ Error checking CORS:', error.message);
        }
    }
    console.log('\n');

    // Test 2: Check Bucket Policy
    console.log('📋 Test 2: Checking Bucket Policy...');
    try {
        const policyCommand = new GetBucketPolicyCommand({ Bucket: BUCKET_NAME });
        const policyResponse = await s3Client.send(policyCommand);
        
        if (policyResponse.Policy) {
            console.log('✅ Bucket policy is configured!');
            const policy = JSON.parse(policyResponse.Policy);
            console.log('   Policy:', JSON.stringify(policy, null, 2));
        } else {
            console.log('⚠️  Bucket policy exists but is empty');
        }
    } catch (error) {
        if (error.name === 'NoSuchBucketPolicy') {
            console.log('❌ Bucket policy is NOT configured!');
            console.log('   Files may not be publicly accessible.');
            console.log('   Follow AWS-CONSOLE-STEPS.md to set bucket policy.');
        } else {
            console.log('❌ Error checking policy:', error.message);
        }
    }
    console.log('\n');

    // Test 3: Check Credentials
    console.log('📋 Test 3: Checking AWS Credentials...');
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('✅ AWS credentials are set in .env');
        console.log('   Access Key ID:', process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...');
    } else {
        console.log('❌ AWS credentials are missing in .env!');
    }
    console.log('\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('If you see ❌ for CORS or Bucket Policy:');
    console.log('1. Open AWS-CONSOLE-STEPS.md');
    console.log('2. Follow Steps 1-3 to configure your S3 bucket');
    console.log('3. Run this test again: node test-s3-config.js');
    console.log('4. Restart your backend server');
    console.log('\n');
}

testS3Config().catch(console.error);
