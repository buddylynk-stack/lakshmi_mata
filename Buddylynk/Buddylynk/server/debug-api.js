/**
 * Debug NSFW API response
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');

const imageUrl = process.argv[2] || 'https://buddylynk-media-bucket-2024.s3.amazonaws.com/1764529418870-301099688.jpg';

async function debugAPI() {
    console.log('\n🔍 Debugging NSFW API...');
    console.log(`📷 Image: ${imageUrl}`);
    
    try {
        // Download image
        console.log('\n1. Downloading image...');
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
        });
        console.log(`   ✅ Downloaded ${imageResponse.data.length} bytes`);
        console.log(`   Content-Type: ${imageResponse.headers['content-type']}`);
        
        // Send to API
        console.log('\n2. Sending to NSFW API...');
        const form = new FormData();
        form.append('image', Buffer.from(imageResponse.data), {
            filename: 'image.jpg',
            contentType: imageResponse.headers['content-type'] || 'image/jpeg'
        });
        
        const apiUrl = process.env.NSFW_API_URL || 'http://35.227.39.141:8002/nsfw';
        console.log(`   API URL: ${apiUrl}`);
        
        const response = await axios.post(apiUrl, form, {
            headers: form.getHeaders(),
            timeout: 30000
        });
        
        console.log('\n3. API Response:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

debugAPI();
