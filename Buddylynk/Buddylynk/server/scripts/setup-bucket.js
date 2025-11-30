const { CreateBucketCommand, PutBucketCorsCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
const fs = require('fs');
const path = require('path');

const BUCKET_NAME_FILE = path.join(__dirname, '../config/bucket-name.txt');

const setupBucket = async () => {
    const bucketName = `buddylynk-media-${Date.now()}`;

    try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket ${bucketName} created successfully.`);

        // Save bucket name for later use
        fs.writeFileSync(BUCKET_NAME_FILE, bucketName);

        // Configure CORS
        const corsParams = {
            Bucket: bucketName,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                        AllowedOrigins: ["*"], // In production, restrict this to the client domain
                        ExposeHeaders: [],
                    },
                ],
            },
        };
        await s3Client.send(new PutBucketCorsCommand(corsParams));
        console.log("CORS configured for bucket.");

    } catch (err) {
        console.error("Error creating bucket:", err);
    }
};

setupBucket();
