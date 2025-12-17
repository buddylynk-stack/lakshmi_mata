/**
 * Debug NSFW API response
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');

const IMAGE_URL = 'https://buddylynk-media-bucket-2024.s3.amazonaws.com/1764696021422-837623385.jpg';
const API_URL = process.env.NSFW_API_URL || 'http://35.227.39.141:8002/nsfw';

async function debugAPI() {
    console.log('\n🔍 Debugging NSFW API...');
    console.log('📷 Image:', IMAGE_URL);
    console.log('🌐 API:', API_URL);
    
    try {
        // Download image
        console.log('\n📥 Downloading image...');
        const imageResponse = await axios.get(IMAGE_URL, {
            responseType: 'arraybuffer',
            timeout: 15000
        });
        console.log('   Size:', imageResponse.data.length, 'bytes');
        console.log('   Type:', imageResponse.headers['content-type']);
        
        // Send to API
        console.log('\n📤 Sending to API...');
        const form = new FormData();
        form.append('image', Buffer.from(imageResponse.data), {
            filename: 'image.jpg',
            contentType: imageResponse.headers['content-type'] || 'image/jpeg'
        });
        
        const response = await axios.post(API_URL, form, {
            headers: form.getHeaders(),
            timeout: 30000
        });
        
        console.log('\n📋 RAW API RESPONSE:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Analyze
        if (response.data.result && response.data.result.parts) {
            console.log('\n📊 DETECTED PARTS:');
            response.data.result.parts.forEach((part, i) => {
                const score = (part.score * 100).toFixed(1);
                const emoji = part.score > 0.7 ? '🔴' : part.score > 0.5 ? '🟡' : '🟢';
                console.log(`   ${emoji} ${part.class}: ${score}%`);
            });
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.log('Response:', error.response.data);
        }
    }
}

debugAPI();
