const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const Post = require("../models/Post");
require("dotenv").config();

async function testDeletePost() {
    try {
        console.log("\n🧪 Testing post deletion with S3 cleanup...\n");

        // Get all posts
        const result = await docClient.send(new ScanCommand({
            TableName: "Buddylynk_Posts",
        }));

        if (result.Items.length === 0) {
            console.log("❌ No posts found to test deletion\n");
            return;
        }

        console.log(`📊 Found ${result.Items.length} posts\n`);

        // Show posts
        result.Items.forEach((post, i) => {
            console.log(`${i + 1}. Post ID: ${post.postId}`);
            console.log(`   User: ${post.username}`);
            console.log(`   Content: ${post.content?.substring(0, 50) || '(no content)'}${post.content?.length > 50 ? '...' : ''}`);
            console.log(`   Media: ${post.media?.length || 0} items`);
            if (post.media && post.media.length > 0) {
                post.media.forEach((m, idx) => {
                    console.log(`      ${idx + 1}. ${m.url}`);
                });
            }
            console.log("");
        });

        // Ask which post to delete
        console.log("💡 To delete a post, run:");
        console.log(`   node server/scripts/delete-specific-post.js <postId>\n`);
        console.log("Or delete all posts:");
        console.log(`   node server/scripts/delete-all-posts.js\n`);

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

testDeletePost();
