require('dotenv').config();
const { DynamoDBClient, ScanCommand, DeleteItemCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

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

const TABLES = [
    "Buddylynk_Users",
    "Buddylynk_Posts",
    "Buddylynk_Messages",
    "Buddylynk_Groups",
    "Buddylynk_Notifications",
    "Buddylynk_PostViews"
];

async function deleteAllItemsFromTable(tableName) {
    console.log(`\n🗑️  Deleting all items from ${tableName}...`);
    
    try {
        // Scan to get all items
        const scanCommand = new ScanCommand({ TableName: tableName });
        const scanResult = await dynamoClient.send(scanCommand);
        
        if (!scanResult.Items || scanResult.Items.length === 0) {
            console.log(`   ✅ ${tableName} is already empty`);
            return 0;
        }

        // Get the primary key name
        let keyName;
        if (tableName.includes('Users')) keyName = 'userId';
        else if (tableName.includes('Posts')) keyName = 'postId';
        else if (tableName.includes('Messages')) keyName = 'messageId';
        else if (tableName.includes('Groups')) keyName = 'groupId';
        else if (tableName.includes('Notifications')) keyName = 'notificationId';
        else if (tableName.includes('PostViews')) keyName = 'viewId';

        let deletedCount = 0;
        
        // Delete each item
        for (const item of scanResult.Items) {
            const deleteCommand = new DeleteItemCommand({
                TableName: tableName,
                Key: {
                    [keyName]: item[keyName]
                }
            });
            
            await dynamoClient.send(deleteCommand);
            deletedCount++;
        }

        console.log(`   ✅ Deleted ${deletedCount} items from ${tableName}`);
        return deletedCount;
        
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            console.log(`   ⚠️  Table ${tableName} does not exist`);
            return 0;
        }
        console.error(`   ❌ Error deleting from ${tableName}:`, error.message);
        return 0;
    }
}

async function deleteAllS3Objects() {
    console.log(`\n🗑️  Deleting all objects from S3 bucket: ${BUCKET_NAME}...`);
    
    try {
        let deletedCount = 0;
        let continuationToken = null;

        do {
            // List objects
            const listCommand = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                ContinuationToken: continuationToken
            });
            
            const listResult = await s3Client.send(listCommand);
            
            if (!listResult.Contents || listResult.Contents.length === 0) {
                if (deletedCount === 0) {
                    console.log(`   ✅ S3 bucket is already empty`);
                }
                break;
            }

            // Delete objects in batches
            const objectsToDelete = listResult.Contents.map(obj => ({ Key: obj.Key }));
            
            if (objectsToDelete.length > 0) {
                const deleteCommand = new DeleteObjectsCommand({
                    Bucket: BUCKET_NAME,
                    Delete: {
                        Objects: objectsToDelete,
                        Quiet: false
                    }
                });
                
                const deleteResult = await s3Client.send(deleteCommand);
                deletedCount += deleteResult.Deleted?.length || 0;
                
                console.log(`   🗑️  Deleted ${deleteResult.Deleted?.length || 0} objects...`);
            }

            continuationToken = listResult.NextContinuationToken;
            
        } while (continuationToken);

        console.log(`   ✅ Total deleted: ${deletedCount} objects from S3`);
        return deletedCount;
        
    } catch (error) {
        console.error(`   ❌ Error deleting from S3:`, error.message);
        return 0;
    }
}

async function cleanupAll() {
    console.log('🚀 Starting complete data cleanup for launch...\n');
    console.log('⚠️  WARNING: This will delete ALL data from DynamoDB and S3!');
    console.log('⚠️  This action CANNOT be undone!\n');

    // Confirmation
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Type "DELETE ALL DATA" to confirm: ', async (answer) => {
        readline.close();

        if (answer !== 'DELETE ALL DATA') {
            console.log('\n❌ Cleanup cancelled. No data was deleted.');
            process.exit(0);
        }

        console.log('\n✅ Confirmed. Starting cleanup...\n');

        try {
            let totalDeleted = 0;

            // Clean DynamoDB tables
            console.log('📊 Cleaning DynamoDB tables...');
            for (const tableName of TABLES) {
                const count = await deleteAllItemsFromTable(tableName);
                totalDeleted += count;
            }

            // Clean S3 bucket
            console.log('\n📦 Cleaning S3 bucket...');
            const s3Count = await deleteAllS3Objects();

            // Summary
            console.log('\n' + '='.repeat(60));
            console.log('🎉 CLEANUP COMPLETE!');
            console.log('='.repeat(60));
            console.log(`\n📊 DynamoDB Summary:`);
            console.log(`   - Total items deleted: ${totalDeleted}`);
            console.log(`   - Tables cleaned: ${TABLES.length}`);
            console.log(`\n📦 S3 Summary:`);
            console.log(`   - Total objects deleted: ${s3Count}`);
            console.log(`   - Bucket: ${BUCKET_NAME}`);
            console.log('\n📄 All Pages Are Now Empty:');
            console.log(`   ✅ Home feed - No posts`);
            console.log(`   ✅ Search - No users`);
            console.log(`   ✅ Groups - No groups`);
            console.log(`   ✅ Profile pages - No posts`);
            console.log(`   ✅ Saved posts - Empty`);
            console.log(`   ✅ Messages - No conversations`);
            console.log(`   ✅ Notifications - Empty`);
            console.log('\n✨ Your database and storage are now clean for launch!');
            console.log('🚀 Ready for production deployment!\n');

        } catch (error) {
            console.error('\n❌ Error during cleanup:', error);
            process.exit(1);
        }
    });
}

cleanupAll();
