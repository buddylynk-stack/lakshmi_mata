const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("../config/db");

const createTable = async (tableName, keySchema, attributeDefinitions) => {
    try {
        const command = new CreateTableCommand({
            TableName: tableName,
            KeySchema: keySchema,
            AttributeDefinitions: attributeDefinitions,
            BillingMode: "PAY_PER_REQUEST",
        });
        await client.send(command);
        console.log(`Table ${tableName} created successfully.`);
    } catch (err) {
        if (err.name === "ResourceInUseException") {
            console.log(`Table ${tableName} already exists.`);
        } else {
            console.error(`Error creating table ${tableName}:`, err);
        }
    }
};

const setup = async () => {
    // Users Table
    await createTable(
        "Buddylynk_Users",
        [{ AttributeName: "userId", KeyType: "HASH" }],
        [{ AttributeName: "userId", AttributeType: "S" }]
    );

    // Posts Table
    await createTable(
        "Buddylynk_Posts",
        [{ AttributeName: "postId", KeyType: "HASH" }],
        [{ AttributeName: "postId", AttributeType: "S" }]
    );

    // Groups Table
    await createTable(
        "Buddylynk_Groups",
        [{ AttributeName: "groupId", KeyType: "HASH" }],
        [{ AttributeName: "groupId", AttributeType: "S" }]
    );

    // Notifications Table
    await createTable(
        "Buddylynk_Notifications",
        [{ AttributeName: "notificationId", KeyType: "HASH" }],
        [{ AttributeName: "notificationId", AttributeType: "S" }]
    );

    // Messages Table
    await createTable(
        "Buddylynk_Messages",
        [{ AttributeName: "messageId", KeyType: "HASH" }],
        [{ AttributeName: "messageId", AttributeType: "S" }]
    );
};

setup();
