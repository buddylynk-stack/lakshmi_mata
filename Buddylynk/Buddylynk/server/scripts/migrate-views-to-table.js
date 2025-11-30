const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const PostView = require("../models/PostView");
require("dotenv").config();

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const migrateViewsToTable = async () => {
    try {
        console.log("🔄 Migrating view data from Posts table to PostViews table...\n");

        // Scan all posts
        const scanCmd = new ScanCommand({
            TableName: "Buddylynk_Posts"
        });

        const result = await docClient.send(scanCmd);
        const posts = result.Items || [];

        console.log(`Found ${posts.length} posts to process\n`);

        let migratedCount = 0;
        let viewsCreated = 0;

        for (const post of posts) {
            if (post.viewedBy && Array.isArray(post.viewedBy) && post.viewedBy.length > 0) {
                console.log(`📊 Post ${post.postId}: ${post.viewedBy.length} viewers`);

                for (const userId of post.viewedBy) {
                    try {
                        // Create view record in PostViews table
                        await PostView.recordView(post.postId, userId, {
                            duration: 0, // Unknown for migrated data
                            deviceType: 'unknown',
                            userAgent: 'migrated',
                            ipHash: null
                        });
                        viewsCreated++;
                    } catch (error) {
                        console.error(`  ❌ Error creating view for user ${userId}:`, error.message);
                    }
                }

                migratedCount++;
                console.log(`  ✅ Migrated ${post.viewedBy.length} views\n`);
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log(`✅ Migration Complete!`);
        console.log(`📊 Posts processed: ${migratedCount}`);
        console.log(`👁️  View records created: ${viewsCreated}`);
        console.log("=".repeat(50));

        console.log("\n💡 Next steps:");
        console.log("1. Verify data in PostViews table");
        console.log("2. Test view tracking with new system");
        console.log("3. Monitor for any issues");
        console.log("4. Old viewedBy arrays in Posts table can be kept for backup");

    } catch (error) {
        console.error("❌ Migration error:", error);
        throw error;
    }
};

migrateViewsToTable()
    .then(() => {
        console.log("\n✅ Migration script completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Migration failed:", error);
        process.exit(1);
    });
