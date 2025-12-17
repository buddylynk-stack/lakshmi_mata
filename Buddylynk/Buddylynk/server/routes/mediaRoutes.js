const express = require('express');
const router = express.Router();
const axios = require('axios');
const { BUCKET_NAME } = require('../config/s3');

// Media proxy - hides S3 URL from public
// URL format: /api/media/:key
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key || !BUCKET_NAME) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Construct S3 URL internally
    const s3Url = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    // Stream from S3 to client
    const response = await axios({
      method: 'GET',
      url: s3Url,
      responseType: 'stream',
      timeout: 30000
    });

    // Forward content type
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache 1 year
    res.set('X-Content-Type-Options', 'nosniff');

    // Pipe S3 response to client
    response.data.pipe(res);
  } catch (error) {
    console.error('Media proxy error:', error.message);
    res.status(404).json({ error: 'Media not found' });
  }
});

module.exports = router;
