const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const Post = require("../models/Post");
require("dotenv").config();

async function deleteAllPosts() {
    try {
        console.log("\n🗑️  Deleting all posts (with S3 cleanup)...\n");

        // Get all posts
        const result = await docClient.send(new ScanCommand({
            TableName: "Buddylynk_Posts",
        }));
        
        if (result.Items.length === 0) {
            console.log("✅ No posts to delete!\n");
            return;
        }

        console.log(`Found ${result.Items.length} posts to delete\n`);

        // Delete each post using the Post model (which handles S3 + PostViews cleanup)
        let deleted = 0;
        let failed = 0;

        for (const post of result.Items) {
            try {
                console.log(`\nDeleting post ${post.postId}...`);
                console.log(`  User: ${post.username}`);
                console.log(`  Content: ${post.content?.substring(0, 50) || '(no content)'}${post.content?.length > 50 ? '...' : ''}`);
                console.log(`  Media: ${post.media?.length || 0} items`);
                
                await Post.deletePost(post.postId);
                deleted++;
                console.log(`  ✅ Post deleted completely\n`);
            } catch (error) {
                failed++;
                console.error(`  ❌ Failed to delete post:`, error.message);
            }
        }

        console.log("\n🎉 Cleanup complete!");
        console.log(`   ✅ Deleted: ${deleted} posts`);
        if (failed > 0) {
            console.log(`   ❌ Failed: ${failed} posts`);
        }
        console.log("");

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

deleteAllPosts();
