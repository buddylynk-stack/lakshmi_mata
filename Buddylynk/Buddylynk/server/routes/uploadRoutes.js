const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { BUCKET_NAME } = require('../config/s3');
const { protect } = require('../middleware/authMiddleware');

// Create a dedicated S3 client for presigned URLs without checksums
const presignedUrlClient = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    // Completely disable checksums for presigned URLs
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
});

// Get presigned URL for direct S3 upload
router.post('/presigned-url', protect, async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        
        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'fileName and fileType required' });
        }

        const key = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${fileName}`;
        
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: fileType
        });

        // Generate presigned URL valid for 10 minutes
        // signableHeaders ensures Content-Type is included in signature
        const uploadUrl = await getSignedUrl(presignedUrlClient, command, { 
            expiresIn: 600,
            signableHeaders: new Set(['host', 'content-type']),
            unhoistableHeaders: new Set([
                'x-amz-checksum-crc32',
                'x-amz-checksum-crc32c', 
                'x-amz-checksum-sha1',
                'x-amz-checksum-sha256',
                'x-amz-sdk-checksum-algorithm'
            ])
        });
        
        const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

        console.log('Generated presigned URL for:', fileName);
        console.log('Key:', key);

        res.json({ uploadUrl, fileUrl });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

// Server-side upload (traditional method - more reliable)
router.post('/server', protect, async (req, res) => {
    try {
        const { uploadToS3 } = require('../middleware/uploadMiddleware');
        const multer = require('multer');
        const upload = multer({ storage: multer.memoryStorage() });
        
        // Use multer middleware
        upload.single('media')(req, res, async (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({ error: 'File upload error' });
            }
            
            if (!req.file) {
                return res.status(400).json({ error: 'No file provided' });
            }
            
            try {
                console.log('📤 Server uploading file:', req.file.originalname);
                const url = await uploadToS3(req.file);
                console.log('✅ Upload successful:', url);
                res.json({ url });
            } catch (uploadError) {
                console.error('S3 upload error:', uploadError);
                res.status(500).json({ error: 'Failed to upload to S3' });
            }
        });
    } catch (error) {
        console.error('Server upload error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
