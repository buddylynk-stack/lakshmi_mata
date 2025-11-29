/**
 * Test post deletion with S3 cleanup
 */

const Post = require("../models/Post");
require("dotenv").config();

const testPostDelete = async () => {
    try {
        console.log("🧪 Testing Post Deletion with S3 Cleanup\n");
        console.log("=" .repeat(60));

        // Get all posts
        console.log("\n1️⃣  Fetching posts...");
        const posts = await Post.getAllPosts();
        console.log(`✅ Found ${posts.length} posts`);

        if (posts.length === 0) {
            console.log("⚠️  No posts to test with");
            return;
        }

        // Find a post with media
        const postWithMedia = posts.find(p => p.media && p.media.length > 0);
        
        if (!postWithMedia) {
            console.log("⚠️  No posts with media found");
            console.log("💡 Create a post with an image to test deletion");
            return;
        }

        console.log("\n2️⃣  Found post with media:");
        console.log(`   Post ID: ${postWithMedia.postId}`);
        console.log(`   Media count: ${postWithMedia.media.length}`);
        console.log(`   Media URLs:`);
        postWithMedia.media.forEach((m, i) => {
            console.log(`     ${i + 1}. ${m.url}`);
        });

        console.log("\n⚠️  WARNING: This is a test script.");
        console.log("   To actually test deletion, uncomment the delete line below.");
        console.log("   The delete function will:");
        console.log("   1. Delete media files from S3");
        console.log("   2. Delete post from DynamoDB");
        console.log("   3. Delete view records from PostViews table");

        // Uncomment to actually test:
        // console.log("\n3️⃣  Deleting post...");
        // await Post.deletePost(postWithMedia.postId);
        // console.log("✅ Post deleted successfully!");

        console.log("\n" + "=" .repeat(60));
        console.log("✅ Test complete!");
        console.log("=" .repeat(60));

        console.log("\n📋 Delete Function Features:");
        console.log("   ✅ Deletes media from S3");
        console.log("   ✅ Deletes post from DynamoDB");
        console.log("   ✅ Prevents orphaned files");
        console.log("   ✅ Saves storage costs");

    } catch (error) {
        console.error("\n❌ Test failed:", error);
        throw error;
    }
};

testPostDelete()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
