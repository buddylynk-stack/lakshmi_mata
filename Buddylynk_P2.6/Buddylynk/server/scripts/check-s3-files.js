const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Read bucket name from file
const BUCKET_NAME_FILE = path.join(__dirname, '../config/bucket-name.txt');
const BUCKET_NAME = fs.readFileSync(BUCKET_NAME_FILE, 'utf8').trim();

async function checkS3Files() {
    try {
        console.log("\n🪣 Checking S3 bucket for files...\n");
        console.log(`Bucket: ${BUCKET_NAME}\n`);

        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
        });

        const response = await s3Client.send(command);

        if (!response.Contents || response.Contents.length === 0) {
            console.log("✅ S3 bucket is empty - no orphaned files!\n");
            return;
        }

        console.log(`📦 Total files in S3: ${response.Contents.length}\n`);

        // Group files by type
        const images = [];
        const videos = [];
        const avatars = [];
        const others = [];

        response.Contents.forEach(file => {
            const key = file.Key;
            const size = (file.Size / 1024).toFixed(2); // KB
            const modified = file.LastModified.toLocaleString();

            if (key.includes('avatar')) {
                avatars.push({ key, size, modified });
            } else if (key.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                images.push({ key, size, modified });
            } else if (key.match(/\.(mp4|mov|avi|webm)$/i)) {
                videos.push({ key, size, modified });
            } else {
                others.push({ key, size, modified });
            }
        });

        if (avatars.length > 0) {
            console.log(`👤 Avatars (${avatars.length}):`);
            avatars.forEach((file, i) => {
                console.log(`   ${i + 1}. ${file.key}`);
                console.log(`      Size: ${file.size} KB | Modified: ${file.modified}`);
            });
            console.log("");
        }

        if (images.length > 0) {
            console.log(`🖼️  Images (${images.length}):`);
            images.forEach((file, i) => {
                console.log(`   ${i + 1}. ${file.key}`);
                console.log(`      Size: ${file.size} KB | Modified: ${file.modified}`);
            });
            console.log("");
        }

        if (videos.length > 0) {
            console.log(`🎥 Videos (${videos.length}):`);
            videos.forEach((file, i) => {
                console.log(`   ${i + 1}. ${file.key}`);
                console.log(`      Size: ${file.size} KB | Modified: ${file.modified}`);
            });
            console.log("");
        }

        if (others.length > 0) {
            console.log(`📄 Other files (${others.length}):`);
            others.forEach((file, i) => {
                console.log(`   ${i + 1}. ${file.key}`);
                console.log(`      Size: ${file.size} KB | Modified: ${file.modified}`);
            });
            console.log("");
        }

        // Calculate total size
        const totalSize = response.Contents.reduce((sum, file) => sum + file.Size, 0);
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        console.log(`💾 Total storage used: ${totalSizeMB} MB\n`);

    } catch (error) {
        console.error("❌ Error checking S3:", error.message);
    }
}

checkS3Files();
