const { DeleteTableCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });

const deleteGroupsTable = async () => {
    try {
        console.log("Checking for Groups table in DynamoDB...\n");
        
        // List all tables
        const listCommand = new ListTablesCommand({});
        const tables = await client.send(listCommand);
        
        console.log("Existing tables:", tables.TableNames);
        
        // Check if Groups table exists
        if (tables.TableNames.includes("Buddylynk_Groups")) {
            console.log("\n⚠️  Found Buddylynk_Groups table. Deleting...");
            
            const deleteCommand = new DeleteTableCommand({
                TableName: "Buddylynk_Groups"
            });
            
            await client.send(deleteCommand);
            
            console.log("✅ Buddylynk_Groups table deleted successfully!");
            console.log("✅ All group data has been removed from AWS");
        } else {
            console.log("\n✅ Buddylynk_Groups table does not exist. Nothing to delete.");
        }
        
    } catch (error) {
        console.error("❌ Error deleting Groups table:", error.message);
        
        if (error.name === "ResourceNotFoundException") {
            console.log("✅ Table already deleted or doesn't exist");
        }
    }
};

deleteGroupsTable();
