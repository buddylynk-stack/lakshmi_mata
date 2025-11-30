require('dotenv').config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Test usernames to delete (add your test accounts here)
const TEST_USERNAMES = [
    'superman',
    'superman1',
    'guddi',
    'test',
    'demo',
    // Add more test usernames here
];

async function deleteTestUsers() {
    console.log('\n👥 Deleting test users...');
    
    try {
        const scanCommand = new ScanCommand({
            TableName: "Buddylynk_Users"
        });
        const result = await docClient.send(scanCommand);
        
        let deletedCount = 0;
        const deletedUserIds = [];

        for (const user of result.Items || []) {
            if (TEST_USERNAMES.includes(user.username.toLowerCase())) {
                const deleteCommand = new DeleteCommand({
                    TableName: "Buddylynk_Users",
                    Key: { userId: user.userId }
                });
                
                await docClient.send(deleteCommand);
                deletedUserIds.push(user.userId);
                deletedCount++;
                console.log(`   ✅ Deleted user: ${user.username} (${user.userId})`);
            }
        }

        console.log(`\n   📊 Total users deleted: ${deletedCount}`);
        return deletedUserIds;
        
    } catch (error) {
        console.error('   ❌ Error deleting users:', error.message);
        return [];
    }
}

async function deleteUserPosts(userIds) {
    console.log('\n📝 Deleting posts from test users...');
    
    try {
        const scanCommand = new ScanCommand({
            TableName: "Buddylynk_Posts"
        });
        const result = await docClient.send(scanCommand);
        
        let deletedCount = 0;

        for (const post of result.Items || []) {
            if (userIds.includes(post.userId)) {
                const deleteCommand = new DeleteCommand({
                    TableName: "Buddylynk_Posts",
                    Key: { postId: post.postId }
                });
                
                await docClient.send(deleteCommand);
                deletedCount++;
            }
        }

        console.log(`   ✅ Deleted ${deletedCount} posts`);
        return deletedCount;
        
    } catch (error) {
        console.error('   ❌ Error deleting posts:', error.message);
        return 0;
    }
}

async function deleteUserMessages(userIds) {
    console.log('\n💬 Deleting messages from test users...');
    
    try {
        const scanCommand = new ScanCommand({
            TableName: "Buddylynk_Messages"
        });
        const result = await docClient.send(scanCommand);
        
        let deletedCount = 0;

        for (const message of result.Items || []) {
            if (userIds.includes(message.senderId) || userIds.includes(message.receiverId)) {
                const deleteCommand = new DeleteCommand({
                    TableName: "Buddylynk_Messages",
                    Key: { messageId: message.messageId }
                });
                
                await docClient.send(deleteCommand);
                deletedCount++;
            }
        }

        console.log(`   ✅ Deleted ${deletedCount} messages`);
        return deletedCount;
        
    } catch (error) {
        console.error('   ❌ Error deleting messages:', error.message);
        return 0;
    }
}

async function deleteUserNotifications(userIds) {
    console.log('\n🔔 Deleting notifications from test users...');
    
    try {
        const scanCommand = new ScanCommand({
            TableName: "Buddylynk_Notifications"
        });
        const result = await docClient.send(scanCommand);
        
        let deletedCount = 0;

        for (const notification of result.Items || []) {
            if (userIds.includes(notification.userId) || userIds.includes(notification.fromUserId)) {
                const deleteCommand = new DeleteCommand({
                    TableName: "Buddylynk_Notifications",
                    Key: { notificationId: notification.notificationId }
                });
                
                await docClient.send(deleteCommand);
                deletedCount++;
            }
        }

        console.log(`   ✅ Deleted ${deletedCount} notifications`);
        return deletedCount;
        
    } catch (error) {
        console.error('   ❌ Error deleting notifications:', error.message);
        return 0;
    }
}

async function deleteUserGroups(userIds) {
    console.log('\n👥 Deleting groups from test users...');
    
    try {
        const scanCommand = new ScanCommand({
            TableName: "Buddylynk_Groups"
        });
        const result = await docClient.send(scanCommand);
        
        let deletedCount = 0;

        for (const group of result.Items || []) {
            if (userIds.includes(group.createdBy)) {
                const deleteCommand = new DeleteCommand({
                    TableName: "Buddylynk_Groups",
                    Key: { groupId: group.groupId }
                });
                
                await docClient.send(deleteCommand);
                deletedCount++;
            }
        }

        console.log(`   ✅ Deleted ${deletedCount} groups`);
        return deletedCount;
        
    } catch (error) {
        console.error('   ❌ Error deleting groups:', error.message);
        return 0;
    }
}

async function deletePostViews(userIds) {
    console.log('\n👁️  Deleting post views from test users...');
    
    try {
        const scanCommand = new ScanCommand({
            TableName: "Buddylynk_PostViews"
        });
        const result = await docClient.send(scanCommand);
        
        let deletedCount = 0;

        for (const view of result.Items || []) {
            if (userIds.includes(view.userId)) {
                const deleteCommand = new DeleteCommand({
                    TableName: "Buddylynk_PostViews",
                    Key: { viewId: view.viewId }
                });
                
                await docClient.send(deleteCommand);
                deletedCount++;
            }
        }

        console.log(`   ✅ Deleted ${deletedCount} post views`);
        return deletedCount;
        
    } catch (error) {
        console.error('   ❌ Error deleting post views:', error.message);
        return 0;
    }
}

async function cleanupTestData() {
    console.log('🧹 Starting test data cleanup...\n');
    console.log('⚠️  This will delete test users and their data');
    console.log(`📋 Test usernames: ${TEST_USERNAMES.join(', ')}\n`);

    try {
        // Delete test users and get their IDs
        const deletedUserIds = await deleteTestUsers();

        if (deletedUserIds.length === 0) {
            console.log('\n✅ No test users found to delete');
            return;
        }

        // Delete related data
        const postsDeleted = await deleteUserPosts(deletedUserIds);
        const messagesDeleted = await deleteUserMessages(deletedUserIds);
        const notificationsDeleted = await deleteUserNotifications(deletedUserIds);
        const groupsDeleted = await deleteUserGroups(deletedUserIds);
        const viewsDeleted = await deletePostViews(deletedUserIds);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✨ TEST DATA CLEANUP COMPLETE!');
        console.log('='.repeat(60));
        console.log(`\n📊 Summary:`);
        console.log(`   - Test users deleted: ${deletedUserIds.length}`);
        console.log(`   - Posts deleted: ${postsDeleted}`);
        console.log(`   - Messages deleted: ${messagesDeleted}`);
        console.log(`   - Notifications deleted: ${notificationsDeleted}`);
        console.log(`   - Groups deleted: ${groupsDeleted}`);
        console.log(`   - Post views deleted: ${viewsDeleted}`);
        console.log(`   - Database structure: Preserved ✅`);
        console.log(`   - S3 files: Preserved (manual cleanup if needed)`);
        console.log('\n📄 Pages that will be empty:');
        console.log(`   ✅ Home feed (no posts)`);
        console.log(`   ✅ Search (no users to find)`);
        console.log(`   ✅ Groups (no groups)`);
        console.log(`   ✅ Profile pages (no posts)`);
        console.log(`   ✅ Saved posts (empty)`);
        console.log('\n🚀 Ready for launch!\n');

    } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
        process.exit(1);
    }
}

cleanupTestData();
