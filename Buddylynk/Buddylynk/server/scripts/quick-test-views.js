const PostView = require("../models/PostView");
require("dotenv").config();

const quickTest = async () => {
    try {
        console.log("🧪 Quick Connection Test\n");
        
        // Test 1: Check if we can query the table
        console.log("1️⃣  Testing PostView.getPostViews()...");
        const testPostId = "c6fa3b10-fdc9-46db-8393-23ed7af7573e"; // From your data
        const views = await PostView.getPostViews(testPostId);
        console.log(`✅ Success! Found ${views.length} view(s) for post`);
        
        // Test 2: Check if we can get view count
        console.log("\n2️⃣  Testing PostView.getPostViewCount()...");
        const stats = await PostView.getPostViewCount(testPostId);
        console.log(`✅ Success!`);
        console.log(`   Unique viewers: ${stats.uniqueViewers}`);
        console.log(`   Total views: ${stats.totalViews}`);
        
        // Test 3: Check if we can check user view
        console.log("\n3️⃣  Testing PostView.hasUserViewedPost()...");
        const testUserId = "0a49e702-bd0d-451e-a7da-f02f7d775344"; // From your data
        const hasViewed = await PostView.hasUserViewedPost(testPostId, testUserId);
        console.log(`✅ Success! User has viewed: ${hasViewed}`);
        
        console.log("\n" + "=".repeat(50));
        console.log("✅ All connection tests passed!");
        console.log("🔗 PostViews table is connected and working!");
        console.log("=".repeat(50));
        
        console.log("\n📊 Summary:");
        console.log("   ✅ Table accessible");
        console.log("   ✅ Queries working");
        console.log("   ✅ Data readable");
        console.log("   ✅ Ready for production use");
        
    } catch (error) {
        console.error("\n❌ Connection test failed!");
        console.error("Error:", error.message);
        
        if (error.name === 'ResourceNotFoundException') {
            console.error("\n💡 Table not found. Create it with:");
            console.error("   node server/scripts/create-post-views-table.js");
        }
        
        throw error;
    }
};

quickTest()
    .then(() => {
        console.log("\n✅ Test completed!");
        process.exit(0);
    })
    .catch(() => {
        process.exit(1);
    });
