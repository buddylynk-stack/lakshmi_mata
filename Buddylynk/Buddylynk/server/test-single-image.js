/**
 * Test NSFW detection on a single image
 * Run with: node test-single-image.js <image_url>
 */

require('dotenv').config();
const { checkNSFW, checkAllMedia } = require('./services/nsfwService');

const imageUrl = process.argv[2];

if (!imageUrl) {
    console.log('Usage: node test-single-image.js <image_url>');
    console.log('');
    console.log('Example:');
    console.log('  node test-single-image.js https://example.com/image.jpg');
    process.exit(1);
}

async function testImage() {
    console.log('\n🔍 Testing NSFW detection...');
    console.log(`📷 Image: ${imageUrl}`);
    console.log('');
    
    try {
        const result = await checkNSFW(imageUrl);
        
        console.log('\n📊 Result:');
        console.log(`   NSFW: ${result.isNsfw ? '🔴 YES' : '🟢 NO'}`);
        console.log(`   Confidence: ${result.confidence?.toFixed(1) || 0}%`);
        console.log(`   Reason: ${result.reason}`);
        
        if (result.detectedParts && result.detectedParts.length > 0) {
            console.log('   Detected parts:');
            result.detectedParts.forEach(p => {
                console.log(`      - ${p.class}: ${(p.score * 100).toFixed(1)}%`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testImage();
