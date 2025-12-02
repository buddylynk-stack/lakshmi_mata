/**
 * Rescan ALL posts and fix false positives
 * Run: node fix-false-positives.js
 */

require('dotenv').config();
const { docClient } = require('./config/db');
const { ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { checkAllMedia } = require('./services/nsfwService');

async function fixAllPosts() {
    console.log('\n🔄 ========== FIXING ALL POSTS ==========');
    
    // Get all posts
    const result = await docClient.send(new ScanCommand({
        TableName: 'Buddylynk_Posts'
    }));
    
    const posts = result.Items || [];
    console.log(`📊 Total posts: ${posts.length}`);
    
    let fixed = 0;
    let unchanged = 0;
    let errors = 0;
    
    for (const post of posts) {
        if (!post.media || post.media.length === 0) {
            unchanged++;
            continue;
        }
        
        try {
            console.log(`\n🔍 Checking post: ${post.postId}`);
            
            // Run fresh NSFW check
            const nsfwResults = await checkAllMedia(post.media);
            
            // Update media flags
            const updatedMedia = post.media.map((mediaItem, index) => {
                const result = nsfwResults[index];
                return {
                    ...mediaItem,
                    isNsfw: result?.isNsfw || false,
                    nsfwConfidence: result?.confidence || 0
                };
            });
            
            const hasNsfwContent = nsfwResults.some(r => r.isNsfw);
            const wasNsfw = post.isNsfw || false;
            
            // Update in database
            await docClient.send(new UpdateCommand({
                TableName: 'Buddylynk_Posts',
                Key: { postId: post.postId },
                UpdateExpression: 'SET #media = :media, #isNsfw = :isNsfw',
                ExpressionAttributeNames: {
                    '#media': 'media',
                    '#isNsfw': 'isNsfw'
                },
                ExpressionAttributeValues: {
                    ':media': updatedMedia,
                    ':isNsfw': hasNsfwContent
                }
            }));
            
            if (wasNsfw !== hasNsfwContent) {
                console.log(`   🔧 FIXED: ${wasNsfw ? 'NSFW→SAFE' : 'SAFE→NSFW'}`);
                fixed++;
            } else {
                console.log(`   ✅ No change needed`);
                unchanged++;
            }
            
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            errors++;
        }
        
        // Delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log('\n📊 ========== RESULTS ==========');
    console.log(`🔧 Fixed: ${fixed}`);
    console.log(`✅ Unchanged: ${unchanged}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('================================\n');
}

fixAllPosts().catch(console.error);
