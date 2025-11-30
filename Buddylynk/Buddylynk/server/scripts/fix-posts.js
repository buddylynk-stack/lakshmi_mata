const { ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const TABLE_NAME = "Buddylynk_Posts";

const fixPosts = async () => {
    try {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
        });
        const response = await docClient.send(command);
        
        console.log(`Found ${response.Items.length} posts to check\n`);
        
        let fixedCount = 0;
        
        for (const post of response.Items) {
            let needsUpdate = false;
            
            // Fix missing media array
            if (!post.media) {
                post.media = [];
                needsUpdate = true;
                console.log(`Fixed media for post ${post.postId}`);
            }
            
            // Fix missing fields
            if (!post.likes) {
                post.likes = 0;
                needsUpdate = true;
            }
            
            if (!post.likedBy) {
                post.likedBy = [];
                needsUpdate = true;
            }
            
            if (!post.comments) {
                post.comments = [];
                needsUpdate = true;
            }
            
            if (!post.shares) {
                post.shares = 0;
                needsUpdate = true;
            }
            
            if (!post.views) {
                post.views = 0;
                needsUpdate = true;
            }
            
            if (!post.savedBy) {
                post.savedBy = [];
                needsUpdate = true;
            }
            
            // Ensure createdAt is valid
            if (!post.createdAt) {
                post.createdAt = new Date().toISOString();
                needsUpdate = true;
                console.log(`Fixed createdAt for post ${post.postId}`);
            }
            
            if (needsUpdate) {
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: post,
                }));
                fixedCount++;
            }
        }
        
        console.log(`\nFixed ${fixedCount} posts`);
        
    } catch (error) {
        console.error("Error fixing posts:", error);
    }
};

fixPosts();
