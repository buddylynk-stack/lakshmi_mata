/**
 * Setup S3 CORS for direct browser uploads
 * Run this once: node setup-s3-cors.js
 */

require('dotenv').config();
const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const corsConfig = {
    Bucket: BUCKET_NAME,
    CORSConfiguration: {
        CORSRules: [
            {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                AllowedOrigins: [
                    'http://localhost:3000',
                    'http://localhost:5173',
                    'http://127.0.0.1:3000',
                    'http://127.0.0.1:5173',
                    'https://buddylynk.com',
                    'https://www.buddylynk.com',
                    'http://buddylynk.com',
                    'http://www.buddylynk.com'
                ],
                ExposeHeaders: ['ETag', 'x-amz-meta-custom-header'],
                MaxAgeSeconds: 3600
            }
        ]
    }
};

async function setupCors() {
    try {
        console.log(`Setting up CORS for bucket: ${BUCKET_NAME}`);
        
        const command = new PutBucketCorsCommand(corsConfig);
        await s3Client.send(command);
        
        console.log('✅ S3 CORS configuration updated successfully!');
        console.log('Direct browser uploads to S3 are now enabled.');
    } catch (error) {
        console.error('❌ Error setting up CORS:', error.message);
        process.exit(1);
    }
}

setupCors();
