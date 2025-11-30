const { DeleteTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });

const deleteGroupPostsTable = async () => {
    try {
        console.log("Deleting Buddylynk_GroupPosts table...\n");
        
        const deleteCommand = new DeleteTableCommand({
            TableName: "Buddylynk_GroupPosts"
        });
        
        await client.send(deleteCommand);
        
        console.log("✅ Buddylynk_GroupPosts table deleted successfully!");
        
    } catch (error) {
        if (error.name === "ResourceNotFoundException") {
            console.log("✅ Table already deleted or doesn't exist");
        } else {
            console.error("❌ Error:", error.message);
        }
    }
};

deleteGroupPostsTable();
