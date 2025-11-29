const { PutBucketPolicyCommand, PutPublicAccessBlockCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
const fs = require('fs');
const path = require('path');

const BUCKET_NAME_FILE = path.join(__dirname, '../config/bucket-name.txt');

const fixBucketPolicy = async () => {
    try {
        const bucketName = fs.readFileSync(BUCKET_NAME_FILE, 'utf8').trim();
        
        if (!bucketName) {
            console.error("Bucket name not found. Please run setup-bucket.js first.");
            return;
        }

        console.log(`Configuring public access for bucket: ${bucketName}`);

        // First, disable the public access block
        await s3Client.send(new PutPublicAccessBlockCommand({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: false,
                IgnorePublicAcls: false,
                BlockPublicPolicy: false,
                RestrictPublicBuckets: false
            }
        }));
        console.log("Public access block disabled.");

        // Then, set the bucket policy to allow public reads
        const bucketPolicy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Sid: "PublicReadGetObject",
                    Effect: "Allow",
                    Principal: "*",
                    Action: "s3:GetObject",
                    Resource: `arn:aws:s3:::${bucketName}/*`
                }
            ]
        };

        await s3Client.send(new PutBucketPolicyCommand({
            Bucket: bucketName,
            Policy: JSON.stringify(bucketPolicy)
        }));
        
        console.log("Bucket policy updated successfully. All objects are now publicly readable.");
        console.log(`Images will be accessible at: https://${bucketName}.s3.amazonaws.com/`);

    } catch (err) {
        console.error("Error updating bucket policy:", err);
        console.error("\nIf you see an AccessDenied error, make sure your AWS credentials have the following permissions:");
        console.error("- s3:PutBucketPolicy");
        console.error("- s3:PutBucketPublicAccessBlock");
    }
};

fixBucketPolicy();
