const multer = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, BUCKET_NAME } = require("../config/s3");
const path = require("path");
const sharp = require("sharp");

const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: Infinity } // Unlimited
});

const uploadToS3 = async (file) => {
    if (!BUCKET_NAME) {
        console.error('❌ S3 Upload Error: Bucket name not configured');
        throw new Error("Bucket name not configured");
    }

    const fileExtension = path.extname(file.originalname);
    const key = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;

    console.log(`📤 Uploading to S3:`);
    console.log(`   File: ${file.originalname}`);
    console.log(`   Original Size: ${(file.size / 1024).toFixed(2)} KB`);
    console.log(`   Type: ${file.mimetype}`);

    let processedBuffer = file.buffer;
    let contentType = file.mimetype;

    // Auto-compress media before upload
    if (file.mimetype.startsWith('image/')) {
        try {
            const isGif = file.mimetype === 'image/gif';
            
            if (!isGif) {
                // Compress and resize images (except GIFs to preserve animation)
                processedBuffer = await sharp(file.buffer)
                    .resize(1920, 1920, { 
                        fit: 'inside',
                        withoutEnlargement: true 
                    })
                    .jpeg({ quality: 85, progressive: true })
                    .toBuffer();
                
                contentType = 'image/jpeg';
                console.log(`   Compressed Size: ${(processedBuffer.length / 1024).toFixed(2)} KB`);
                console.log(`   Savings: ${((1 - processedBuffer.length / file.size) * 100).toFixed(1)}%`);
            }
        } catch (error) {
            console.warn('⚠️  Image compression failed, uploading original:', error.message);
            processedBuffer = file.buffer;
        }
    } else if (file.mimetype.startsWith('video/')) {
        // Videos upload as-is (compression would take too long on server)
        // Consider using client-side compression or AWS MediaConvert for production
        console.log(`   Video upload: ${file.mimetype}`);
    }

    console.log(`   Bucket: ${BUCKET_NAME}`);
    console.log(`   Key: ${key}`);

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: processedBuffer,
        ContentType: contentType,
        // ACL removed - use bucket policy for public access instead
        CacheControl: 'max-age=31536000', // Cache for 1 year
    });

    try {
        await s3Client.send(command);
        const url = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
        console.log(`✅ S3 Upload Success: ${url}`);
        return url;
    } catch (error) {
        console.error(`❌ S3 Upload Failed:`, error.message);
        throw error;
    }
};

// Delete file from S3
const deleteFromS3 = async (fileUrl) => {
    if (!fileUrl || !BUCKET_NAME) return;

    try {
        // Extract key from S3 URL
        // URL format: https://bucket-name.s3.amazonaws.com/key
        const urlParts = fileUrl.split('/');
        const key = urlParts[urlParts.length - 1];

        if (!key) {
            console.warn('⚠️  Could not extract S3 key from URL:', fileUrl);
            return;
        }

        console.log(`🗑️  Deleting old image from S3: ${key}`);

        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await s3Client.send(command);
        console.log(`✅ Deleted old image: ${key}`);
    } catch (error) {
        console.error('❌ Failed to delete from S3:', error.message);
        // Don't throw - deletion failure shouldn't block upload
    }
};

module.exports = { upload, uploadToS3, deleteFromS3 };
