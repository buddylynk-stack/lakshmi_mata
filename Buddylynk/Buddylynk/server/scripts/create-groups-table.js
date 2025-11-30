const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });

const createGroupsTable = async () => {
    try {
        console.log("Creating Buddylynk_Groups table...\n");
        
        const command = new CreateTableCommand({
            TableName: "Buddylynk_Groups",
            KeySchema: [
                { AttributeName: "groupId", KeyType: "HASH" }
            ],
            AttributeDefinitions: [
                { AttributeName: "groupId", AttributeType: "S" }
            ],
            BillingMode: "PAY_PER_REQUEST"
        });
        
        await client.send(command);
        console.log("✅ Buddylynk_Groups table created successfully!");
        
    } catch (error) {
        if (error.name === "ResourceInUseException") {
            console.log("✅ Table already exists");
        } else {
            console.error("❌ Error:", error.message);
        }
    }
};

createGroupsTable();
