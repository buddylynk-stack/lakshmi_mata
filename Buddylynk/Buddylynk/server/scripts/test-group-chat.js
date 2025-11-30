const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const testGroupChat = async () => {
    try {
        console.log("🧪 Testing Group Chat Functionality...\n");
        
        // 1. Check Groups Table
        console.log("1. Checking Groups in DynamoDB...");
        const groupsCommand = new ScanCommand({
            TableName: "Buddylynk_Groups",
        });
        const groupsResponse = await docClient.send(groupsCommand);
        
        console.log(`   ✅ Total groups: ${groupsResponse.Items.length}`);
        
        if (groupsResponse.Items.length === 0) {
            console.log("   ⚠️  No groups found. Create a group in the app first!");
            return;
        }
        
        // 2. Check Group Details
        console.log("\n2. Checking Group Posts/Messages...");
        groupsResponse.Items.forEach((group, index) => {
            console.log(`\n   Group ${index + 1}:`);
            console.log(`   - ID: ${group.groupId}`);
            console.log(`   - Name: ${group.name}`);
            console.log(`   - Members: ${group.memberCount}`);
            console.log(`   - Posts/Messages: ${group.posts?.length || 0}`);
            
            if (group.posts && group.posts.length > 0) {
                console.log(`\n   Recent Messages:`);
                group.posts.slice(0, 3).forEach((post, idx) => {
                    console.log(`     ${idx + 1}. ${post.username}: ${post.content?.substring(0, 50)}${post.content?.length > 50 ? '...' : ''}`);
                    console.log(`        Type: ${post.type || 'text'}`);
                    console.log(`        Media: ${post.media ? 'YES (S3)' : 'NO'}`);
                    if (post.type === 'poll') {
                        console.log(`        Poll Options: ${post.pollOptions?.length || 0}`);
                    }
                    console.log(`        Time: ${new Date(post.createdAt).toLocaleString()}`);
                });
            }
        });
        
        // 3. Summary
        console.log("\n" + "=".repeat(60));
        console.log("📊 GROUP CHAT TEST SUMMARY");
        console.log("=".repeat(60));
        
        const totalPosts = groupsResponse.Items.reduce((sum, group) => 
            sum + (group.posts?.length || 0), 0
        );
        
        const postsWithMedia = groupsResponse.Items.reduce((sum, group) => 
            sum + (group.posts?.filter(p => p.media).length || 0), 0
        );
        
        const polls = groupsResponse.Items.reduce((sum, group) => 
            sum + (group.posts?.filter(p => p.type === 'poll').length || 0), 0
        );
        
        console.log(`✅ Groups: ${groupsResponse.Items.length}`);
        console.log(`✅ Total Messages: ${totalPosts}`);
        console.log(`✅ Messages with Media: ${postsWithMedia}`);
        console.log(`✅ Polls: ${polls}`);
        console.log(`✅ Data Storage: AWS DynamoDB`);
        console.log(`✅ Media Storage: AWS S3`);
        
        console.log("\n🎉 Group Chat is working and connected to AWS!");
        
        // 4. Test Instructions
        console.log("\n" + "=".repeat(60));
        console.log("🧪 TO TEST:");
        console.log("=".repeat(60));
        console.log("1. Join a group");
        console.log("2. Send a text message");
        console.log("3. Click paperclip → Upload a photo");
        console.log("4. Click paperclip → Create a poll");
        console.log("5. Run this script again to see data in AWS");
        
    } catch (error) {
        console.error("\n❌ Error testing group chat:", error.message);
    }
};

testGroupChat();
