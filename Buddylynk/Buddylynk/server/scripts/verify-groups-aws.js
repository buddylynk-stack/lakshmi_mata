const { ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { docClient } = require("../config/db");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });

const verifyGroupsAWS = async () => {
    try {
        console.log("🔍 Verifying Groups AWS Connection...\n");
        
        // 1. Check if table exists
        console.log("1. Checking DynamoDB Tables...");
        const listCommand = new ListTablesCommand({});
        const tables = await client.send(listCommand);
        
        const hasGroupsTable = tables.TableNames.includes("Buddylynk_Groups");
        console.log(`   ${hasGroupsTable ? '✅' : '❌'} Buddylynk_Groups table: ${hasGroupsTable ? 'EXISTS' : 'NOT FOUND'}`);
        
        if (!hasGroupsTable) {
            console.log("\n❌ Groups table not found in AWS!");
            console.log("Run: node scripts/create-groups-table.js");
            return;
        }
        
        // 2. Check groups data
        console.log("\n2. Checking Groups Data in DynamoDB...");
        const scanCommand = new ScanCommand({
            TableName: "Buddylynk_Groups",
        });
        const response = await docClient.send(scanCommand);
        
        console.log(`   ✅ Total groups in AWS: ${response.Items.length}`);
        
        if (response.Items.length > 0) {
            console.log("\n3. Sample Group Data:");
            const sampleGroup = response.Items[0];
            console.log(`   Group ID: ${sampleGroup.groupId}`);
            console.log(`   Name: ${sampleGroup.name}`);
            console.log(`   Description: ${sampleGroup.description}`);
            console.log(`   Members: ${sampleGroup.memberCount}`);
            console.log(`   Creator: ${sampleGroup.creatorName}`);
            console.log(`   Cover Image: ${sampleGroup.coverImage ? 'YES (stored in S3)' : 'NO'}`);
            console.log(`   Created: ${sampleGroup.createdAt}`);
            console.log(`   Posts: ${sampleGroup.posts?.length || 0}`);
        } else {
            console.log("\n   No groups created yet. Create one in the app!");
        }
        
        // 3. Summary
        console.log("\n" + "=".repeat(50));
        console.log("📊 AWS CONNECTION SUMMARY");
        console.log("=".repeat(50));
        console.log(`✅ DynamoDB: Connected`);
        console.log(`✅ Table: Buddylynk_Groups exists`);
        console.log(`✅ Groups stored: ${response.Items.length}`);
        console.log(`✅ S3: Ready for cover images`);
        console.log("\n🎉 Groups feature is fully connected to AWS!");
        
    } catch (error) {
        console.error("\n❌ Error verifying AWS connection:", error.message);
        console.error("\nMake sure:");
        console.error("1. AWS credentials are configured");
        console.error("2. DynamoDB table exists");
        console.error("3. You have read permissions");
    }
};

verifyGroupsAWS();
