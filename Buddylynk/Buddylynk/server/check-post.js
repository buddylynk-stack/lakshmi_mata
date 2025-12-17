/**
 * Check specific post for NSFW and update it
 * Run: node check-post.js
 */

require('dotenv').config();
const { docClient } = require('./config/db');
const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { checkAllMedia } = require('./services/nsfwService');

const POST_ID = '325e5f89-d197-4d12-9c83-04ea817d966c';

async function checkAndUpdatePost() {
    console.log('\n🔍 Fetching post:', POST_ID);
    
    // Get the post
    const result = await docClient.send(new GetCommand({
        TableName: 'Buddylynk_Posts',
        Key: { postId: POST_ID }
    }));
    
    const post = result.Item;
    
    if (!post) {
        console.log('❌ Post not found!');
        return;
    }
    
    console.log('\n📝 Post found:');
    console.log('   Content:', post.content?.substring(0, 50) || '(no content)');
    console.log('   Media count:', post.media?.length || 0);
    console.log('   Current isNsfw:', post.isNsfw);
    
    if (post.media && post.media.length > 0) {
        console.log('\n📎 Media URLs:');
        post.media.forEach((m, i) => {
            console.log(`   ${i + 1}. ${m.url?.substring(0, 80)}...`);
            console.log(`      Type: ${m.type}, isNsfw: ${m.isNsfw || false}`);
        });
        
        // Run NSFW check
        console.log('\n🔍 Running NSFW detection...');
        const nsfwResults = await checkAllMedia(post.media);
        
        // Check results
        const nsfwMedia = nsfwResults.filter(r => r.isNsfw);
        const hasNsfwContent = nsfwMedia.length > 0;
        
        console.log('\n📊 Detection Results:');
        nsfwResults.forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.isNsfw ? '⚠️ NSFW' : '✅ SAFE'} - ${r.reason} (${r.confidence?.toFixed(1) || 0}%)`);
        });
        
        // Update media with isNsfw flags
        const updatedMedia = post.media.map((mediaItem, index) => {
            const result = nsfwResults[index];
            return {
                ...mediaItem,
                isNsfw: result?.isNsfw || false,
                nsfwConfidence: result?.confidence || 0
            };
        });
        
        // Update post in database
        console.log('\n💾 Updating post in database...');
        await docClient.send(new UpdateCommand({
            TableName: 'Buddylynk_Posts',
            Key: { postId: POST_ID },
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
        
        console.log('\n✅ Post updated!');
        console.log('   isNsfw:', hasNsfwContent);
        console.log('   Media flags:', updatedMedia.map(m => m.isNsfw));
        
    } else {
        console.log('\n⚠️ No media in this post');
    }
}

checkAndUpdatePost().catch(console.error);
