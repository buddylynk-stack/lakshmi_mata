require('dotenv').config();
const { DynamoDBClient, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const docClient = DynamoDBDocumentClient.from(client);

async function checkPostsTable() {
    console.log('🔍 Checking Buddylynk_Posts table...\n');
    
    try {
        // 1. Describe table structure
        console.log('📋 Table Structure:');
        const describeCommand = new DescribeTableCommand({ 
            TableName: "Buddylynk_Posts" 
        });
        const tableInfo = await client.send(describeCommand);
        
        console.log(`   Table Name: ${tableInfo.Table.TableName}`);
        console.log(`   Status: ${tableInfo.Table.TableStatus}`);
        console.log(`   Item Count: ${tableInfo.Table.ItemCount}`);
        console.log(`   Created: ${new Date(tableInfo.Table.CreationDateTime).toLocaleString()}`);
        console.log('');

        // 2. Scan for sample posts
        console.log('📊 Sample Posts (checking for shares column):');
        const scanCommand = new ScanCommand({
            TableName: "Buddylynk_Posts",
            Limit: 5 // Get first 5 posts
        });
        const result = await docClient.send(scanCommand);
        
        if (result.Items && result.Items.length > 0) {
            console.log(`   Found ${result.Items.length} post(s)\n`);
            
            result.Items.forEach((post, index) => {
                console.log(`   Post ${index + 1}:`);
                console.log(`      postId: ${post.postId}`);
                console.log(`      username: ${post.username || 'N/A'}`);
                console.log(`      content: ${post.content?.substring(0, 50) || 'N/A'}...`);
                console.log(`      likes: ${post.likes || 0}`);
                console.log(`      comments: ${post.comments?.length || 0}`);
                console.log(`      shares: ${post.shares !== undefined ? post.shares : '❌ NOT FOUND'}`);
                console.log(`      views: ${post.views || 0}`);
                console.log(`      createdAt: ${post.createdAt || 'N/A'}`);
                console.log('');
            });

            // Check if shares column exists
            const hasShares = result.Items.some(post => post.shares !== undefined);
            
            if (hasShares) {
                console.log('✅ SUCCESS: "shares" column exists in posts!');
            } else {
                console.log('⚠️  WARNING: "shares" column NOT FOUND in existing posts');
                console.log('   This is normal for old posts. New posts will have the shares column.');
                console.log('   You can update existing posts by sharing them once.');
            }
        } else {
            console.log('   ℹ️  No posts found in table');
            console.log('   Create a post to test the shares column');
        }

        console.log('\n📝 Column Structure for New Posts:');
        console.log('   When creating a new post, these columns are initialized:');
        console.log('   - postId (string)');
        console.log('   - userId (string)');
        console.log('   - username (string)');
        console.log('   - content (string)');
        console.log('   - media (array)');
        console.log('   - likes (number) = 0');
        console.log('   - likedBy (array) = []');
        console.log('   - comments (array) = []');
        console.log('   - shares (number) = 0 ✅');
        console.log('   - views (number) = 0');
        console.log('   - savedBy (array) = []');
        console.log('   - createdAt (string)');

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.name === 'ResourceNotFoundException') {
            console.log('\n⚠️  Table "Buddylynk_Posts" does not exist!');
            console.log('   Please create the table first.');
        }
    }
}

checkPostsTable();
