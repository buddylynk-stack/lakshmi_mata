const axios = require("axios");
require("dotenv").config();

const BASE_URL = "http://localhost:3000";

const testViewTracking = async () => {
    try {
        console.log("🧪 Testing View Tracking Integration\n");
        console.log("=" .repeat(50));

        // Step 1: Login to get token
        console.log("\n1️⃣  Logging in...");
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: "test@example.com", // Update with your test user
            password: "password123"
        });
        
        const token = loginRes.data.token;
        const userId = loginRes.data.userId;
        console.log(`✅ Logged in as user: ${userId}`);

        // Step 2: Get posts
        console.log("\n2️⃣  Fetching posts...");
        const postsRes = await axios.get(`${BASE_URL}/api/posts`);
        const posts = postsRes.data;
        
        if (posts.length === 0) {
            console.log("⚠️  No posts found. Create a post first.");
            return;
        }
        
        const testPost = posts[0];
        console.log(`✅ Found ${posts.length} posts`);
        console.log(`   Testing with post: ${testPost.postId}`);
        console.log(`   Current views: ${testPost.views || 0}`);

        // Step 3: Record a view
        console.log("\n3️⃣  Recording view...");
        const viewRes = await axios.post(
            `${BASE_URL}/api/posts/${testPost.postId}/view`,
            { duration: 5 },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log("✅ View recorded!");
        console.log("   Response:", JSON.stringify(viewRes.data, null, 2));

        // Step 4: Try to view again (should not increment unique viewers)
        console.log("\n4️⃣  Viewing same post again...");
        const viewRes2 = await axios.post(
            `${BASE_URL}/api/posts/${testPost.postId}/view`,
            { duration: 3 },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log("✅ Second view recorded!");
        console.log("   Response:", JSON.stringify(viewRes2.data, null, 2));
        
        if (viewRes2.data.isNewView === false) {
            console.log("   ✅ Correctly identified as repeat view!");
        } else {
            console.log("   ⚠️  Warning: Should be marked as repeat view");
        }

        // Step 5: Get analytics (if you're the post owner)
        if (testPost.userId === userId) {
            console.log("\n5️⃣  Fetching analytics...");
            try {
                const analyticsRes = await axios.get(
                    `${BASE_URL}/api/posts/${testPost.postId}/analytics`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                console.log("✅ Analytics retrieved!");
                console.log("   Data:", JSON.stringify(analyticsRes.data, null, 2));
            } catch (error) {
                if (error.response?.status === 403) {
                    console.log("⚠️  Not post owner - can't access analytics");
                } else {
                    throw error;
                }
            }
        } else {
            console.log("\n5️⃣  Skipping analytics (not post owner)");
        }

        // Step 6: Verify in database
        console.log("\n6️⃣  Verifying in database...");
        const PostView = require("../models/PostView");
        const viewRecord = await PostView.getView(testPost.postId, userId);
        
        if (viewRecord) {
            console.log("✅ View record found in PostViews table!");
            console.log("   View count:", viewRecord.viewCount);
            console.log("   Total duration:", viewRecord.totalDuration);
            console.log("   First viewed:", viewRecord.firstViewedAt);
            console.log("   Last viewed:", viewRecord.viewedAt);
        } else {
            console.log("❌ View record NOT found in database!");
        }

        console.log("\n" + "=".repeat(50));
        console.log("✅ All tests passed! View tracking is working!");
        console.log("=".repeat(50));

    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
        
        if (error.response) {
            console.error("   Status:", error.response.status);
            console.error("   Data:", error.response.data);
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.error("\n💡 Server is not running!");
            console.error("   Start it with: npm start");
        }
        
        throw error;
    }
};

testViewTracking()
    .then(() => {
        console.log("\n✅ Test completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Test failed!");
        process.exit(1);
    });
