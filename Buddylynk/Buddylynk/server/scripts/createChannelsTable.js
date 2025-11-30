const { CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("../config/db");

const createChannelsTable = async () => {
    const tableName = "Buddylynk_Channels";
    
    try {
        // Check if table already exists
        try {
            await client.send(new DescribeTableCommand({ TableName: tableName }));
            console.log(`✅ Table ${tableName} already exists`);
            return;
        } catch (error) {
            if (error.name !== "ResourceNotFoundException") {
                throw error;
            }
        }
        
        // Create the table
        const command = new CreateTableCommand({
            TableName: tableName,
            KeySchema: [
                { AttributeName: "channelId", KeyType: "HASH" }
            ],
            AttributeDefinitions: [
                { AttributeName: "channelId", AttributeType: "S" }
            ],
            BillingMode: "PAY_PER_REQUEST"
        });
        
        await client.send(command);
        console.log(`✅ Table ${tableName} created successfully!`);
        console.log("⏳ Waiting for table to become active...");
        
        // Wait for table to be active
        let tableActive = false;
        while (!tableActive) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const describeCommand = new DescribeTableCommand({ TableName: tableName });
            const response = await client.send(describeCommand);
            if (response.Table.TableStatus === "ACTIVE") {
                tableActive = true;
                console.log(`✅ Table ${tableName} is now active!`);
            }
        }
    } catch (error) {
        console.error("❌ Error creating table:", error);
    }
};

// Run if called directly
if (require.main === module) {
    require("dotenv").config();
    createChannelsTable().then(() => process.exit(0));
}

module.exports = { createChannelsTable };
