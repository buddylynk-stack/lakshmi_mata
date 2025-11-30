const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
require("dotenv").config();

async function checkAllPosts() {
    try {
        console.log("\n🔍 Checking all posts in database...\n");

        const params = {
            TableName: "Buddylynk_Posts",
        };

        const result = await docClient.send(new ScanCommand(params));
        
        console.log(`📊 Total posts found: ${result.Items.length}\n`);

        if (result.Items.length === 0) {
            console.log("✅ No posts in database - all deleted successfully!\n");
        } else {
            console.log("📝 Posts in database:\n");
            result.Items.forEach((post, index) => {
                console.log(`${index + 1}. Post ID: ${post.postId}`);
                console.log(`   User: ${post.username} (${post.userId})`);
                console.log(`   Content: ${post.content?.substring(0, 50)}${post.content?.length > 50 ? '...' : ''}`);
                console.log(`   Created: ${new Date(post.createdAt).toLocaleString()}`);
                console.log(`   Media: ${post.media?.length || 0} items`);
                console.log("");
            });
        }
    } catch (error) {
        console.error("❌ Error checking posts:", error);
    }
}

checkAllPosts();
