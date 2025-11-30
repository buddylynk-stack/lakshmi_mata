require("dotenv").config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ 
    region: process.env.AWS_REGION || "us-east-1" 
});

const createGroupPostsTable = async () => {
    const params = {
        TableName: "Buddylynk_GroupPosts",
        KeySchema: [
            { AttributeName: "postId", KeyType: "HASH" }, // Partition key
        ],
        AttributeDefinitions: [
            { AttributeName: "postId", AttributeType: "S" },
        ],
        BillingMode: "PAY_PER_REQUEST", // On-demand billing
    };

    try {
        const command = new CreateTableCommand(params);
        const response = await client.send(command);
        console.log("✅ GroupPosts table created successfully:", response.TableDescription.TableName);
        console.log("Table Status:", response.TableDescription.TableStatus);
    } catch (error) {
        if (error.name === "ResourceInUseException") {
            console.log("ℹ️  Table already exists");
        } else {
            console.error("❌ Error creating table:", error);
        }
    }
};

createGroupPostsTable();
