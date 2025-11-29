const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Read bucket name from file
const BUCKET_NAME_FILE = path.join(__dirname, '../config/bucket-name.txt');
const BUCKET_NAME = fs.readFileSync(BUCKET_NAME_FILE, 'utf8').trim();

async function findOrphanedFiles() {
    try {
        console.log("\n🔍 Finding orphaned S3 files...\n");

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

        console.log(`📊 Found ${usedUrls.size} files being used in database\n`);

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
        const usedFiles = [];

        s3Result.Contents.forEach(file => {
            const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${file.Key}`;
            const size = (file.Size / 1024).toFixed(2);
            
            if (usedUrls.has(fileUrl)) {
                usedFiles.push({ key: file.Key, size, url: fileUrl });
            } else {
                orphanedFiles.push({ key: file.Key, size, url: fileUrl, modified: file.LastModified });
            }
        });

        console.log(`✅ Files being used: ${usedFiles.length}`);
        if (usedFiles.length > 0) {
            usedFiles.forEach((file, i) => {
                console.log(`   ${i + 1}. ${file.key} (${file.size} KB)`);
            });
        }
        console.log("");

        console.log(`🗑️  Orphaned files (not in database): ${orphanedFiles.length}`);
        if (orphanedFiles.length > 0) {
            const totalOrphanedSize = orphanedFiles.reduce((sum, f) => sum + parseFloat(f.size), 0);
            console.log(`💰 Wasted storage: ${(totalOrphanedSize / 1024).toFixed(2)} MB\n`);
            
            orphanedFiles.forEach((file, i) => {
                console.log(`   ${i + 1}. ${file.key}`);
                console.log(`      Size: ${file.size} KB`);
                console.log(`      Modified: ${file.modified.toLocaleString()}`);
            });
            console.log("");
            console.log("💡 To clean up orphaned files, run: node server/scripts/cleanup-orphaned-files.js");
        } else {
            console.log("✅ No orphaned files - S3 bucket is clean!\n");
        }

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

findOrphanedFiles();
