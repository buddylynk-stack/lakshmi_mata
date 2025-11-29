/**
 * Force refresh user data to fix old avatar URLs
 * This helps when users have stale data in their browser
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
require("dotenv").config();

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const refreshUserData = async () => {
    try {
        console.log("🔄 Checking user data...\n");

        const scanCmd = new ScanCommand({
            TableName: "Buddylynk_Users"
        });

        const result = await docClient.send(scanCmd);
        const users = result.Items || [];

        console.log(`Found ${users.length} users\n`);

        for (const user of users) {
            console.log(`User: ${user.username}`);
            console.log(`  Avatar: ${user.avatar || 'None'}`);
            
            // Check if avatar is accessible
            if (user.avatar && user.avatar.includes('s3.amazonaws.com')) {
                try {
                    const response = await fetch(user.avatar, { method: 'HEAD' });
                    if (response.ok) {
                        console.log(`  ✅ Avatar accessible (${response.status})`);
                    } else {
                        console.log(`  ❌ Avatar not accessible (${response.status})`);
                        console.log(`  💡 User should re-upload avatar`);
                    }
                } catch (error) {
                    console.log(`  ❌ Avatar check failed: ${error.message}`);
                }
            } else {
                console.log(`  ℹ️  Using fallback avatar`);
            }
            console.log();
        }

        console.log("=" .repeat(60));
        console.log("✅ User data check complete!");
        console.log("=" .repeat(60));
        
        console.log("\n💡 To fix avatar issues:");
        console.log("1. Log out and log back in (gets fresh data from server)");
        console.log("2. OR go to Edit Profile and re-upload avatar");
        console.log("3. OR clear browser cache and localStorage");

    } catch (error) {
        console.error("❌ Error:", error);
        throw error;
    }
};

refreshUserData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
