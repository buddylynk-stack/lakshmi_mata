const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, BUCKET_NAME } = require("../config/s3");
const path = require("path");
const sharp = require("sharp");

// Optimized multer config
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 10
  }
});

// Fast image compression with sharp
const compressImage = async (buffer, mimetype) => {
  try {
    // Skip GIFs to preserve animation
    if (mimetype === 'image/gif') {
      return { buffer, contentType: mimetype };
    }

    // Get image metadata first
    const metadata = await sharp(buffer).metadata();
    
    // Skip if already small
    if (buffer.length < 200 * 1024 && metadata.width <= 1920) {
      return { buffer, contentType: mimetype };
    }

    // Fast compression settings
    const compressed = await sharp(buffer, { failOnError: false })
      .resize(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true,
        fastShrinkOnLoad: true // Faster resizing
      })
      .jpeg({
        quality: 82,
        progressive: true,
        mozjpeg: true // Better compression
      })
      .toBuffer();

    console.log(`📦 Compressed: ${(buffer.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`);
    return { buffer: compressed, contentType: 'image/jpeg' };
  } catch (error) {
    console.warn('⚠️ Compression failed:', error.message);
    return { buffer, contentType: mimetype };
  }
};

// Get masked media URL (hides S3 bucket)
const getMediaUrl = (key) => {
  const apiBase = process.env.API_BASE_URL || 'http://localhost:5000';
  return `${apiBase}/api/media/${key}`;
};

// Main upload function - optimized for speed
const uploadToS3 = async (file) => {
  if (!BUCKET_NAME) {
    throw new Error("S3 bucket not configured");
  }

  const startTime = Date.now();
  const ext = path.extname(file.originalname);
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;

  console.log(`📤 Upload: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

  let uploadBuffer = file.buffer;
  let contentType = file.mimetype;

  // Compress images server-side (backup for client compression)
  if (file.mimetype.startsWith('image/')) {
    const result = await compressImage(file.buffer, file.mimetype);
    uploadBuffer = result.buffer;
    contentType = result.contentType;
  }

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: uploadBuffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  });

  await s3Client.send(command);
  
  // Return masked URL (hides S3 bucket from public)
  const url = getMediaUrl(key);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Uploaded in ${elapsed}s: ${url}`);
  
  return url;
};

// Parallel upload for multiple files
const uploadMultipleToS3 = async (files) => {
  const results = await Promise.all(
    files.map(file => uploadToS3(file))
  );
  return results;
};

// Delete from S3
const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl || !BUCKET_NAME) return;

  try {
    const key = fileUrl.split('/').pop();
    if (!key) return;

    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    console.log(`🗑️ Deleted: ${key}`);
  } catch (error) {
    console.error('Delete failed:', error.message);
  }
};

module.exports = { upload, uploadToS3, uploadMultipleToS3, deleteFromS3 };
