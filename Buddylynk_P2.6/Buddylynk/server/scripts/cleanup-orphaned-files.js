const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { ListObjectsV2Command, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, BUCKET_NAME } = require("../config/s3");
require("dotenv").config();

async function cleanupOrphanedFiles() {
    try {
        console.log("\n🧹 Cleaning up orphaned S3 files...\n");

        // Get all posts from database
        const postsResult = await docClient.send(new ScanCommand({
            TableName: "Buddylynk_Posts",
        }));

        // Get all users from database
        const usersResult = await docClient.send(new ScanCommand({
            TableName: "Buddylynk_Users",
        }));

        // Collect all media URLs being used
        const usedUrls = new Set();

        // Add post media URLs
        postsResult.Items.forEach(post => {
            if (post.media && post.media.length > 0) {
                post.media.forEach(mediaItem => {
                    usedUrls.add(mediaItem.url);
                });
            }
            if (post.mediaUrl) {
                usedUrls.add(post.mediaUrl);
            }
        });

        // Add user avatar URLs
        usersResult.Items.forEach(user => {
            if (user.avatar && user.avatar.includes('s3.amazonaws.com')) {
                usedUrls.add(user.avatar);
            }
            if (user.banner && user.banner.includes('s3.amazonaws.com')) {
                usedUrls.add(user.banner);
            }
        });

        console.log(`✅ Found ${usedUrls.size} files being used in database\n`);

        // Get all files from S3
        const s3Result = await s3Client.send(new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
        }));

        if (!s3Result.Contents || s3Result.Contents.length === 0) {
            console.log("✅ S3 bucket is empty\n");
            return;
        }

        console.log(`📦 Found ${s3Result.Contents.length} files in S3\n`);

        // Find orphaned files
        const orphanedFiles = [];

        s3Result.Contents.forEach(file => {
            const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${file.Key}`;
            
            if (!usedUrls.has(fileUrl)) {
                orphanedFiles.push({
                    key: file.Key,
                    size: file.Size,
                    url: fileUrl
                });
            }
        });

        if (orphanedFiles.length === 0) {
            console.log("✅ No orphaned files found - S3 bucket is clean!\n");
            return;
        }

        const totalSize = orphanedFiles.reduce((sum, f) => sum + f.size, 0);
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

        console.log(`🗑️  Found ${orphanedFiles.length} orphaned files`);
        console.log(`💰 Will free up: ${totalSizeMB} MB\n`);

        // Delete orphaned files
        let deleted = 0;
        let failed = 0;

        for (const file of orphanedFiles) {
            try {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.key,
                }));
                deleted++;
                console.log(`✅ Deleted: ${file.key} (${(file.size / 1024).toFixed(2)} KB)`);
            } catch (error) {
                failed++;
                console.error(`❌ Failed to delete ${file.key}:`, error.message);
            }
        }

        console.log(`\n🎉 Cleanup complete!`);
        console.log(`   ✅ Deleted: ${deleted} files`);
        if (failed > 0) {
            console.log(`   ❌ Failed: ${failed} files`);
        }
        console.log(`   💾 Freed up: ${totalSizeMB} MB\n`);

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

cleanupOrphanedFiles();
