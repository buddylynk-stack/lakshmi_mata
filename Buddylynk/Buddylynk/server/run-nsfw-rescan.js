/**
 * Direct NSFW rescan script - runs without server
 * Run with: node run-nsfw-rescan.js
 */

require('dotenv').config();

const { docClient } = require('./config/db');
const { ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { checkAllMedia } = require('./services/nsfwService');

const TABLE_NAME = "Buddylynk_Posts";

async function getAllPosts() {
    const command = new ScanCommand({ TableName: TABLE_NAME });
    const response = await docClient.send(command);
    return response.Items || [];
}

async function updatePost(postId, media, isNsfw) {
    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { postId },
        UpdateExpression: "SET #media = :media, #isNsfw = :isNsfw",
        ExpressionAttributeNames: {
            "#media": "media",
            "#isNsfw": "isNsfw"
        },
        ExpressionAttributeValues: {
            ":media": media,
            ":isNsfw": isNsfw
        }
    }));
}

async function rescanAllPosts() {
    console.log('\n🔄 ========== NSFW RESCAN STARTED ==========');
    console.log(`🌐 NSFW API: ${process.env.NSFW_API_URL}`);
    
    const allPosts = await getAllPosts();
    console.log(`📊 Total posts to scan: ${allPosts.length}`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let nsfwFound = 0;
    
    for (const post of allPosts) {
        // Skip posts without media
        if (!post.media || post.media.length === 0) {
            skipped++;
            continue;
        }
        
        try {
            console.log(`\n🔍 Scanning post: ${post.postId} (${post.media.length} media)`);
            
            // Run NSFW check on all media
            const nsfwResults = await checkAllMedia(post.media);
            
            // Check if any media is NSFW
            const nsfwMedia = nsfwResults.filter(result => result.isNsfw);
            const hasNsfwContent = nsfwMedia.length > 0;
            
            if (hasNsfwContent) {
                nsfwFound++;
                console.log(`   ⚠️  NSFW DETECTED in ${nsfwMedia.length} media item(s)`);
            }
            
            // Update media items with isNsfw flag
            const updatedMedia = post.media.map((mediaItem, index) => {
                const result = nsfwResults[index];
                if (result && result.isNsfw) {
                    return {
                        ...mediaItem,
                        isNsfw: true,
                        nsfwConfidence: result.confidence
                    };
                }
                return {
                    ...mediaItem,
                    isNsfw: false
                };
            });
            
            // Update post in database
            await updatePost(post.postId, updatedMedia, hasNsfwContent);
            console.log(`   ✅ Updated post - NSFW: ${hasNsfwContent}`);
            updated++;
            
        } catch (postError) {
            console.error(`   ❌ Error scanning post ${post.postId}:`, postError.message);
            errors++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 ========== NSFW RESCAN COMPLETE ==========');
    console.log(`📝 Total posts: ${allPosts.length}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped (no media): ${skipped}`);
    console.log(`⚠️  NSFW found: ${nsfwFound}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('=============================================\n');
}

rescanAllPosts().catch(console.error);
