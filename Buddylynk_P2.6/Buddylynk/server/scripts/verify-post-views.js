const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
require("dotenv").config();

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const verifyPostViews = async () => {
    try {
        console.log("🔍 Verifying PostViews data...\n");

        const scanCmd = new ScanCommand({
            TableName: "Buddylynk_PostViews"
        });

        const result = await docClient.send(scanCmd);
        const views = result.Items || [];

        console.log(`📊 Total view records: ${views.length}\n`);

        if (views.length === 0) {
            console.log("⚠️  No view records found.");
            console.log("This could mean:");
            console.log("  1. No posts have been viewed yet");
            console.log("  2. Migration didn't find any viewedBy data");
            console.log("  3. Table is still syncing (DynamoDB eventual consistency)\n");
            return;
        }

        // Group by post
        const postViews = {};
        views.forEach(view => {
            if (!postViews[view.postId]) {
                postViews[view.postId] = [];
            }
            postViews[view.postId].push(view);
        });

        console.log("📈 Views by Post:\n");
        Object.entries(postViews).forEach(([postId, postViewList]) => {
            console.log(`Post: ${postId}`);
            console.log(`  Unique viewers: ${postViewList.length}`);
            console.log(`  Total views: ${postViewList.reduce((sum, v) => sum + (v.viewCount || 1), 0)}`);
            console.log(`  Viewers:`);
            postViewList.forEach(v => {
                console.log(`    - ${v.userId} (viewed ${v.viewCount || 1}x, first: ${v.firstViewedAt})`);
            });
            console.log();
        });

        // Sample view record
        if (views.length > 0) {
            console.log("📝 Sample View Record:\n");
            console.log(JSON.stringify(views[0], null, 2));
        }

        console.log("\n✅ Verification complete!");

    } catch (error) {
        console.error("❌ Error verifying views:", error);
        throw error;
    }
};

verifyPostViews()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
