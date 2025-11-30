const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const TABLE_NAME = "Buddylynk_Posts";

const checkPosts = async () => {
    try {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
        });
        const response = await docClient.send(command);
        
        console.log(`Found ${response.Items.length} posts\n`);
        
        response.Items.forEach((post, index) => {
            console.log(`\n--- Post ${index + 1} ---`);
            console.log(`Post ID: ${post.postId}`);
            console.log(`Created At: ${post.createdAt}`);
            console.log(`Content: ${post.content?.substring(0, 50)}...`);
            console.log(`Media: ${post.media ? JSON.stringify(post.media) : 'None'}`);
            console.log(`Media URL (old): ${post.mediaUrl || 'None'}`);
            console.log(`Username: ${post.username}`);
        });
        
    } catch (error) {
        console.error("Error checking posts:", error);
    }
};

checkPosts();
