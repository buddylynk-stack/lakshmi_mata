const { DynamoDBClient, DescribeTableCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");
require("dotenv").config();

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const checkPostViewsTable = async () => {
    try {
        console.log("🔍 Checking for PostViews table...\n");

        // List all tables
        const listCmd = new ListTablesCommand({});
        const listResult = await client.send(listCmd);
        
        console.log("📋 All tables in DynamoDB:");
        listResult.TableNames.forEach(name => {
            console.log(`  - ${name}`);
        });
        console.log();

        // Check if PostViews exists
        if (listResult.TableNames.includes("Buddylynk_PostViews")) {
            console.log("✅ Buddylynk_PostViews table EXISTS!\n");
            
            // Get table details
            const describeCmd = new DescribeTableCommand({ TableName: "Buddylynk_PostViews" });
            const describeResult = await client.send(describeCmd);
            const table = describeResult.Table;
            
            console.log("📊 Table Details:");
            console.log(`  Status: ${table.TableStatus}`);
            console.log(`  Items: ${table.ItemCount || 0}`);
            console.log(`  Size: ${table.TableSizeBytes || 0} bytes`);
            console.log(`  Created: ${table.CreationDateTime}`);
            console.log();
            
            console.log("🔑 Key Schema:");
            table.KeySchema.forEach(key => {
                console.log(`  - ${key.AttributeName} (${key.KeyType})`);
            });
            console.log();
            
            if (table.GlobalSecondaryIndexes) {
                console.log("📇 Global Secondary Indexes:");
                table.GlobalSecondaryIndexes.forEach(gsi => {
                    console.log(`  - ${gsi.IndexName}`);
                    console.log(`    Status: ${gsi.IndexStatus}`);
                    gsi.KeySchema.forEach(key => {
                        console.log(`    Key: ${key.AttributeName} (${key.KeyType})`);
                    });
                });
                console.log();
            }
            
            console.log("✅ Table is ready to use!");
            return true;
        } else {
            console.log("❌ PostViews table DOES NOT EXIST\n");
            console.log("📝 To create it, run:");
            console.log("   node server/scripts/create-post-views-table.js\n");
            return false;
        }
    } catch (error) {
        console.error("❌ Error checking table:", error.message);
        
        if (error.name === 'ResourceNotFoundException') {
            console.log("\n💡 Table not found. Create it with:");
            console.log("   node server/scripts/create-post-views-table.js");
        }
        
        return false;
    }
};

checkPostViewsTable()
    .then((exists) => {
        process.exit(exists ? 0 : 1);
    })
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
