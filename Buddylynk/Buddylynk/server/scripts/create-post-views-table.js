const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
require("dotenv").config();

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const createPostViewsTable = async () => {
    const tableName = "Buddylynk_PostViews";

    try {
        // Check if table already exists
        try {
            const describeCmd = new DescribeTableCommand({ TableName: tableName });
            await client.send(describeCmd);
            console.log(`✅ Table ${tableName} already exists`);
            return;
        } catch (error) {
            if (error.name !== 'ResourceNotFoundException') {
                throw error;
            }
        }

        console.log(`Creating ${tableName} table...`);

        const command = new CreateTableCommand({
            TableName: tableName,
            KeySchema: [
                { AttributeName: "viewId", KeyType: "HASH" } // Composite: postId#userId
            ],
            AttributeDefinitions: [
                { AttributeName: "viewId", AttributeType: "S" },
                { AttributeName: "postId", AttributeType: "S" },
                { AttributeName: "userId", AttributeType: "S" },
                { AttributeName: "viewedAt", AttributeType: "S" }
            ],
            GlobalSecondaryIndexes: [
                {
                    IndexName: "PostIdIndex",
                    KeySchema: [
                        { AttributeName: "postId", KeyType: "HASH" },
                        { AttributeName: "viewedAt", KeyType: "RANGE" }
                    ],
                    Projection: { ProjectionType: "ALL" },
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                },
                {
                    IndexName: "UserIdIndex",
                    KeySchema: [
                        { AttributeName: "userId", KeyType: "HASH" },
                        { AttributeName: "viewedAt", KeyType: "RANGE" }
                    ],
                    Projection: { ProjectionType: "ALL" },
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                }
            ],
            BillingMode: "PROVISIONED",
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            }
        });

        await client.send(command);
        console.log(`✅ Table ${tableName} created successfully!`);
        console.log(`
📊 Table Structure:
- Primary Key: viewId (postId#userId)
- GSI 1: PostIdIndex (postId + viewedAt) - Query all views for a post
- GSI 2: UserIdIndex (userId + viewedAt) - Query all posts viewed by user

🔒 Security Features:
- Composite key prevents duplicate views
- Conditional writes prevent race conditions
- Separate table isolates view data
- IP hashing for fraud detection
- Device fingerprinting
        `);

    } catch (error) {
        console.error("Error creating table:", error);
        throw error;
    }
};

createPostViewsTable()
    .then(() => {
        console.log("\n✅ PostViews table setup complete!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });
