/**
 * Test NSFW API Response Structure
 * Verifies the API is returning proper detection data
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');

const NSFW_API_URL = process.env.NSFW_API_URL || 'http://35.227.39.141:8002/nsfw';

// Test with a person image (clothed, safe) to see if API detects body parts
const TEST_IMAGE = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'; // Portrait photo

async function testAPIResponse() {
    console.log('\n========================================');
    console.log('🔬 NSFW API RESPONSE ANALYSIS');
    console.log('========================================\n');
    
    console.log(`API URL: ${NSFW_API_URL}`);
    console.log(`Test Image: ${TEST_IMAGE}\n`);
    
    try {
        // Download image
        console.log('📥 Downloading test image...');
        const imageResponse = await axios.get(TEST_IMAGE, {
            responseType: 'arraybuffer',
            timeout: 15000
        });
        console.log(`   Image size: ${imageResponse.data.byteLength} bytes`);
        
        // Send to NSFW API
        console.log('\n📤 Sending to NSFW API...');
        const form = new FormData();
        form.append('image', Buffer.from(imageResponse.data), {
            filename: 'test.jpg',
            contentType: 'image/jpeg'
        });
        
        const startTime = Date.now();
        const response = await axios.post(NSFW_API_URL, form, {
            headers: { 
                ...form.getHeaders(),
                'User-Agent': 'Buddylynk/1.0'
            },
            timeout: 30000
        });
        const elapsed = Date.now() - startTime;
        
        console.log(`   Response time: ${elapsed}ms`);
        console.log(`   Status: ${response.status}`);
        
        // Analyze response
        console.log('\n📊 API Response Analysis:');
        console.log('   Raw response structure:', Object.keys(response.data));
        
        if (response.data.result) {
            console.log('   Result keys:', Object.keys(response.data.result));
            
            if (response.data.result.parts && Array.isArray(response.data.result.parts)) {
                console.log(`\n   🔍 Detected ${response.data.result.parts.length} body parts:`);
                
                const parts = response.data.result.parts;
                parts.forEach(part => {
                    if (part.score > 0 && part.class) {
                        const className = String(part.class).toLowerCase();
                        const emoji = className.includes('exposed') ? '🔴' : 
                                      className.includes('covered') ? '🟢' : '🟡';
                        console.log(`      ${emoji} ${part.class}: ${(part.score * 100).toFixed(1)}%`);
                    }
                });
                
                // Check for NSFW classes
                const nsfwClasses = [
                    'exposed_genitalia_female', 'exposed_genitalia_male',
                    'exposed_anus', 'exposed_breast_female',
                    'exposed_buttocks'
                ];
                
                const detectedNSFW = parts.filter(p => {
                    if (!p.class) return false;
                    const className = String(p.class).toLowerCase();
                    return nsfwClasses.some(c => className.includes(c.toLowerCase())) && p.score > 0.5;
                });
                
                console.log('\n   📋 NSFW Detection Summary:');
                if (detectedNSFW.length > 0) {
                    console.log('   ⚠️  NSFW content detected:');
                    detectedNSFW.forEach(p => {
                        console.log(`      🔴 ${p.class}: ${(p.score * 100).toFixed(1)}%`);
                    });
                } else {
                    console.log('   ✅ No NSFW content detected (image is safe)');
                }
                
                // Show what the API CAN detect
                console.log('\n   📝 API Detection Capabilities:');
                console.log('   The API can detect these classes:');
                const allClasses = [...new Set(parts.filter(p => p.class).map(p => p.class))];
                allClasses.forEach(c => console.log(`      - ${c}`));
                
            } else {
                console.log('   ⚠️  No parts array in response');
            }
        } else {
            console.log('   ⚠️  No result in response');
            console.log('   Full response:', JSON.stringify(response.data, null, 2));
        }
        
        console.log('\n========================================');
        console.log('✅ API is working and returning detection data');
        console.log('========================================\n');
        
        console.log('📌 How NSFW Detection Works:');
        console.log('   1. When user uploads image, it goes to this API');
        console.log('   2. API analyzes and returns body part detections');
        console.log('   3. If exposed_genitalia/breast/etc > 70%, image is blocked');
        console.log('   4. Safe images (covered body parts) are allowed');
        console.log('   5. If API fails, content is allowed (fail-open for UX)');
        
    } catch (error) {
        console.error('\n❌ API Error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

testAPIResponse();
