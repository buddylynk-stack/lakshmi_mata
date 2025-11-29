const { DynamoDBClient, CreateTableCommand, ListTablesCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
require("dotenv").config();

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const tables = [
    {
        TableName: "Buddylynk_Users",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "userId", AttributeType: "S" }],
        BillingMode: "PAY_PER_REQUEST"
    },
    {
        TableName: "Buddylynk_Posts",
        KeySchema: [{ AttributeName: "postId", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "postId", AttributeType: "S" }],
        BillingMode: "PAY_PER_REQUEST"
    },
    {
        TableName: "Buddylynk_Groups",
        KeySchema: [{ AttributeName: "groupId", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "groupId", AttributeType: "S" }],
        BillingMode: "PAY_PER_REQUEST"
    },
    {
        TableName: "Buddylynk_Messages",
        KeySchema: [{ AttributeName: "messageId", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "messageId", AttributeType: "S" }],
        BillingMode: "PAY_PER_REQUEST"
    },
    {
        TableName: "Buddylynk_Notifications",
        KeySchema: [{ AttributeName: "notificationId", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "notificationId", AttributeType: "S" }],
        BillingMode: "PAY_PER_REQUEST"
    },
    {
        TableName: "Buddylynk_PostViews",
        KeySchema: [{ AttributeName: "viewId", KeyType: "HASH" }],
        AttributeDefinitions: [
            { AttributeName: "viewId", AttributeType: "S" },
            { AttributeName: "postId", AttributeType: "S" },
            { AttributeName: "userId", AttributeType: "S" }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: "PostIdIndex",
                KeySchema: [{ AttributeName: "postId", KeyType: "HASH" }],
                Projection: { ProjectionType: "ALL" }
            },
            {
                IndexName: "UserIdIndex",
                KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
                Projection: { ProjectionType: "ALL" }
            }
        ],
        BillingMode: "PAY_PER_REQUEST"
    }
];

async function createTables() {
    console.log("🚀 Starting DynamoDB table creation...\n");

    // Get existing tables
    const listResult = await client.send(new ListTablesCommand({}));
    const existingTables = listResult.TableNames || [];
    console.log("📋 Existing tables:", existingTables.join(", ") || "None\n");

    for (const tableConfig of tables) {
        const tableName = tableConfig.TableName;
        
        if (existingTables.includes(tableName)) {
            console.log(`✅ Table "${tableName}" already exists - skipping`);
            continue;
        }

        try {
            console.log(`📦 Creating table "${tableName}"...`);
            await client.send(new CreateTableCommand(tableConfig));
            console.log(`   ✅ Table "${tableName}" created successfully!`);
        } catch (error) {
            if (error.name === "ResourceInUseException") {
                console.log(`   ⚠️  Table "${tableName}" already exists`);
            } else {
                console.error(`   ❌ Error creating "${tableName}":`, error.message);
            }
        }
    }

    console.log("\n🎉 DynamoDB table setup complete!");
    console.log("\n📊 Summary of tables:");
    
    // List all tables again
    const finalList = await client.send(new ListTablesCommand({}));
    const buddylynkTables = (finalList.TableNames || []).filter(t => t.startsWith("Buddylynk_"));
    buddylynkTables.forEach(t => console.log(`   - ${t}`));
}

createTables().catch(console.error);
