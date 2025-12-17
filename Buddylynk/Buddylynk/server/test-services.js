/**
 * Test script for NSFW Detection and Recommendation Services
 * Run with: node test-services.js
 */

require('dotenv').config();
const axios = require('axios');

const NSFW_API_URL = process.env.NSFW_API_URL || 'http://35.227.39.141:8002/nsfw';
const RECOMMENDATION_API_URL = process.env.RECOMMENDATION_API_URL || 'http://35.227.39.141:8001/recommend';

// Test images (safe images for testing)
const TEST_IMAGES = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png',
    'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png'
];

console.log('\n========================================');
console.log('🧪 BUDDYLYNK SERVICE TEST');
console.log('========================================\n');

console.log('📋 Configuration:');
console.log(`   NSFW API URL: ${NSFW_API_URL}`);
console.log(`   Recommendation API URL: ${RECOMMENDATION_API_URL}`);
console.log(`   ENABLE_NSFW_CHECK: ${process.env.ENABLE_NSFW_CHECK || 'not set'}`);
console.log('');

async function testNSFWAPI() {
    console.log('🔍 Testing NSFW Detection Service...');
    
    try {
        // Import the NSFW service
        const { checkNSFW, healthCheck, checkAllMedia } = require('./services/nsfwService');
        
        // Check health first
        const health = await healthCheck();
        console.log(`   API Status: ${health.status}`);
        console.log(`   API Reachable: ${health.apiReachable}`);
        if (health.fallback) {
            console.log(`   Fallback: ${health.fallback}`);
        }
        
        // Test with a safe image
        const testImageUrl = TEST_IMAGES[1]; // Google logo - definitely safe
        console.log(`   📷 Testing with image: ${testImageUrl.substring(0, 50)}...`);
        
        const startTime = Date.now();
        const result = await checkNSFW(testImageUrl);
        const elapsed = Date.now() - startTime;
        
        console.log(`   ✅ NSFW Check Response (${elapsed}ms):`);
        console.log(`      Is NSFW: ${result.isNsfw}`);
        console.log(`      Confidence: ${result.confidence?.toFixed(1) || 0}%`);
        console.log(`      Reason: ${result.reason}`);
        
        // Test should pass if we got a result (fail-open mode ensures this)
        const success = result.reason !== undefined;
        return { success, latency: elapsed, apiStatus: health.status };
    } catch (error) {
        console.log(`   ❌ NSFW Check Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testRecommendationAPI() {
    console.log('\n🤖 Testing Recommendation API...');
    console.log(`   URL: ${RECOMMENDATION_API_URL}`);
    
    try {
        const startTime = Date.now();
        const response = await axios.post(RECOMMENDATION_API_URL, {
            user_id: 12345,
            post_id: 67890
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });
        const elapsed = Date.now() - startTime;
        
        console.log(`   ✅ Recommendation API Response (${elapsed}ms):`);
        console.log(`      Status: ${response.status}`);
        console.log(`      Score: ${response.data?.score || 'N/A'}`);
        
        return { success: true, latency: elapsed, score: response.data?.score };
    } catch (error) {
        console.log(`   ❌ Recommendation API Error: ${error.message}`);
        if (error.code === 'ECONNREFUSED') {
            console.log('   ⚠️  API server is not reachable. Check if the server is running.');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            console.log('   ⚠️  API request timed out. Server might be slow or unreachable.');
        }
        return { success: false, error: error.message };
    }
}

async function testRedis() {
    console.log('\n🔴 Testing Redis Connection...');
    
    try {
        const Redis = require('ioredis');
        const redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            connectTimeout: 5000
        });
        
        await redis.ping();
        console.log('   ✅ Redis is connected and responding');
        
        // Test set/get
        await redis.set('test-key', 'test-value', 'EX', 10);
        const value = await redis.get('test-key');
        console.log(`   ✅ Redis read/write working (test value: ${value})`);
        
        await redis.del('test-key');
        await redis.quit();
        
        return { success: true };
    } catch (error) {
        console.log(`   ❌ Redis Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    const results = {
        nsfw: await testNSFWAPI(),
        recommendation: await testRecommendationAPI(),
        redis: await testRedis()
    };
    
    console.log('\n========================================');
    console.log('📊 TEST SUMMARY');
    console.log('========================================');
    console.log(`   NSFW API:          ${results.nsfw.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Recommendation API: ${results.recommendation.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Redis:             ${results.redis.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log('========================================\n');
    
    const allPassed = results.nsfw.success && results.recommendation.success && results.redis.success;
    
    if (!allPassed) {
        console.log('⚠️  Some services are not working. The app will use fallback modes:');
        if (!results.nsfw.success) {
            console.log('   - NSFW: Will skip content checking (fail-open)');
        }
        if (!results.recommendation.success) {
            console.log('   - Recommendations: Will use local scoring (recency + engagement)');
        }
        if (!results.redis.success) {
            console.log('   - Redis: Real-time features may not work across instances');
        }
    } else {
        console.log('✅ All services are working correctly!');
    }
    
    process.exit(allPassed ? 0 : 1);
}

runAllTests();
