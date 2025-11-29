const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PutBucketPolicyCommand, PutPublicAccessBlockCommand, PutBucketCorsCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const fixBucketPermissions = async () => {
    try {
        console.log(`\n🔧 Fixing S3 bucket permissions for: ${BUCKET_NAME}\n`);

        // Step 1: Disable block public access
        console.log('1️⃣  Disabling public access blocks...');
        await s3Client.send(new PutPublicAccessBlockCommand({
            Bucket: BUCKET_NAME,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: false,
                IgnorePublicAcls: false,
                BlockPublicPolicy: false,
                RestrictPublicBuckets: false
            }
        }));
        console.log('   ✅ Public access blocks disabled\n');

        // Step 2: Set bucket policy to allow public read
        console.log('2️⃣  Setting bucket policy for public read access...');
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
        console.log('   ✅ Bucket policy updated\n');

        // Step 3: Configure CORS to allow browser access
        console.log('3️⃣  Configuring CORS policy...');
        const corsConfiguration = {
            CORSRules: [
                {
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["GET", "HEAD"],
                    AllowedOrigins: ["*"],
                    ExposeHeaders: ["ETag"],
                    MaxAgeSeconds: 3000
                }
            ]
        };

        await s3Client.send(new PutBucketCorsCommand({
            Bucket: BUCKET_NAME,
            CORSConfiguration: corsConfiguration
        }));
        console.log('   ✅ CORS policy configured\n');

        console.log(`✅ SUCCESS! Bucket ${BUCKET_NAME} is now fully configured:`);
        console.log('   - Public read access enabled');
        console.log('   - CORS configured for browser access');
        console.log('   - All new uploads will be publicly accessible\n');

    } catch (err) {
        console.error("\n❌ Error fixing bucket permissions:", err.message);
        console.error("\nTroubleshooting:");
        console.error("   1. Check AWS credentials in .env file");
        console.error("   2. Verify IAM user has S3 permissions");
        console.error("   3. Ensure bucket name is correct\n");
        process.exit(1);
    }
};

fixBucketPermissions();
