const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const TABLE_NAME = "Buddylynk_Posts";

const checkSavedPosts = async () => {
    try {
        console.log("Checking saved posts in DynamoDB...\n");
        
        const command = new ScanCommand({
            TableName: TABLE_NAME,
        });
        const response = await docClient.send(command);
        
        console.log(`Total posts in DynamoDB: ${response.Items.length}\n`);
        
        // Find posts that have been saved by users
        const savedPosts = response.Items.filter(post => 
            post.savedBy && post.savedBy.length > 0
        );
        
        console.log(`Posts with saves: ${savedPosts.length}\n`);
        
        if (savedPosts.length > 0) {
            console.log("=== SAVED POSTS DETAILS ===\n");
            savedPosts.forEach((post, index) => {
                console.log(`Post ${index + 1}:`);
                console.log(`  Post ID: ${post.postId}`);
                console.log(`  Content: ${post.content?.substring(0, 50)}${post.content?.length > 50 ? '...' : ''}`);
                console.log(`  Author: ${post.username}`);
                console.log(`  Saved by ${post.savedBy.length} user(s):`);
                post.savedBy.forEach(userId => {
                    console.log(`    - ${userId}`);
                });
                console.log(`  Media: ${post.media?.length || 0} file(s)`);
                console.log(`  Likes: ${post.likes || 0}`);
                console.log(`  Comments: ${post.comments?.length || 0}`);
                console.log(`  Created: ${post.createdAt}`);
                console.log('');
            });
        } else {
            console.log("No posts have been saved yet.");
            console.log("\nTo test:");
            console.log("1. Go to the app");
            console.log("2. Click the bookmark icon on any post");
            console.log("3. Run this script again to see the saved post");
        }
        
        // Summary
        console.log("\n=== SUMMARY ===");
        console.log(`✅ Connected to DynamoDB`);
        console.log(`✅ Table: ${TABLE_NAME}`);
        console.log(`✅ Total posts: ${response.Items.length}`);
        console.log(`✅ Posts with saves: ${savedPosts.length}`);
        
        const totalSaves = savedPosts.reduce((sum, post) => sum + (post.savedBy?.length || 0), 0);
        console.log(`✅ Total save actions: ${totalSaves}`);
        
    } catch (error) {
        console.error("❌ Error checking saved posts:", error.message);
        console.error("\nMake sure:");
        console.error("1. AWS credentials are configured");
        console.error("2. DynamoDB table exists");
        console.error("3. You have read permissions");
    }
};

checkSavedPosts();
