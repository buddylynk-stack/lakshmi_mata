const { ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const TABLE_NAME = "Buddylynk_Posts";

const migrateViews = async () => {
    try {
        console.log("Migrating posts to add viewedBy field...\n");
        
        const command = new ScanCommand({
            TableName: TABLE_NAME,
        });
        const response = await docClient.send(command);
        
        console.log(`Found ${response.Items.length} posts\n`);
        
        let migratedCount = 0;
        
        for (const post of response.Items) {
            let needsUpdate = false;
            
            // Add viewedBy array if it doesn't exist
            if (!post.viewedBy) {
                post.viewedBy = [];
                needsUpdate = true;
            }
            
            // Ensure views is a number
            if (typeof post.views !== 'number') {
                post.views = 0;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await docClient.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: post,
                }));
                migratedCount++;
                console.log(`✅ Migrated post: ${post.postId}`);
            }
        }
        
        console.log(`\n✅ Migration complete! Updated ${migratedCount} posts`);
        
    } catch (error) {
        console.error("❌ Error migrating posts:", error);
    }
};

migrateViews();
