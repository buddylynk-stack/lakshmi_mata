const { S3Client } = require("@aws-sdk/client-s3");

// Optimized S3 client for faster uploads
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  // Performance optimizations
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  // Faster connection settings
  maxAttempts: 3,
  retryMode: "adaptive",
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

module.exports = { s3Client, BUCKET_NAME };
