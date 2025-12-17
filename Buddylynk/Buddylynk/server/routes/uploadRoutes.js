const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { BUCKET_NAME } = require('../config/s3');
const { protect } = require('../middleware/authMiddleware');
const { upload, uploadToS3, uploadMultipleToS3 } = require('../middleware/uploadMiddleware');

// Get API base URL for masked media URLs
const getMediaUrl = (key) => {
  const apiBase = process.env.API_BASE_URL || 'http://localhost:5000';
  return `${apiBase}/api/media/${key}`;
};

// Dedicated S3 client for presigned URLs (no checksums)
const presignedClient = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED'
});

// Get presigned URL for direct S3 upload (fastest method)
router.post('/presigned-url', protect, async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType required' });
    }

    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType
    });

    // 15 min expiry for large files
    const uploadUrl = await getSignedUrl(presignedClient, command, {
      expiresIn: 900,
      signableHeaders: new Set(['host', 'content-type']),
      unhoistableHeaders: new Set([
        'x-amz-checksum-crc32',
        'x-amz-checksum-crc32c',
        'x-amz-checksum-sha1',
        'x-amz-checksum-sha256',
        'x-amz-sdk-checksum-algorithm'
      ])
    });

    // Return masked URL (hides S3 bucket)
    const fileUrl = getMediaUrl(key);
    console.log(`📝 Presigned URL for: ${fileName}`);

    res.json({ uploadUrl, fileUrl, key });
  } catch (error) {
    console.error('Presigned URL error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Batch presigned URLs (for multiple files)
router.post('/presigned-urls', protect, async (req, res) => {
  try {
    const { files } = req.body; // Array of { fileName, fileType }

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files array required' });
    }

    const urls = await Promise.all(
      files.map(async ({ fileName, fileType }) => {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: fileType
        });

        const uploadUrl = await getSignedUrl(presignedClient, command, {
          expiresIn: 900,
          signableHeaders: new Set(['host', 'content-type']),
          unhoistableHeaders: new Set([
            'x-amz-checksum-crc32',
            'x-amz-checksum-crc32c',
            'x-amz-checksum-sha1',
            'x-amz-checksum-sha256',
            'x-amz-sdk-checksum-algorithm'
          ])
        });

        return {
          uploadUrl,
          fileUrl: getMediaUrl(key), // Masked URL
          key
        };
      })
    );

    console.log(`📝 Generated ${urls.length} presigned URLs`);
    res.json({ urls });
  } catch (error) {
    console.error('Batch presigned URL error:', error);
    res.status(500).json({ error: 'Failed to generate upload URLs' });
  }
});

// Server-side upload (fallback - single file)
router.post('/server', protect, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const url = await uploadToS3(req.file);
    res.json({ url });
  } catch (error) {
    console.error('Server upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Server-side upload (multiple files)
router.post('/server/multiple', protect, upload.array('media', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const urls = await uploadMultipleToS3(req.files);
    res.json({ urls });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
