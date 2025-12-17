/**
 * NSFW Detection Test Script
 * Tests the NSFW detection with various safe images
 * Run with: node test-nsfw-detection.js
 */

require('dotenv').config();
const { checkNSFW, checkAllMedia, healthCheck } = require('./services/nsfwService');

// Test images - all SAFE images for testing
const TEST_IMAGES = {
    safe: [
        {
            name: 'Google Logo',
            url: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png',
            expected: false
        },
        {
            name: 'Wikipedia PNG',
            url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png',
            expected: false
        },
        {
            name: 'Nature Image',
            url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
            expected: false
        },
        {
            name: 'City Skyline',
            url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400',
            expected: false
        },
        {
            name: 'Food Image',
            url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
            expected: false
        }
    ]
};

async function runTests() {
    console.log('\n========================================');
    console.log('🧪 NSFW DETECTION TEST SUITE');
    console.log('========================================\n');
    
    // Health check
    console.log('📋 Service Health Check...');
    const health = await healthCheck();
    console.log(`   Status: ${health.status}`);
    console.log(`   API Reachable: ${health.apiReachable}`);
    console.log('');
    
    let passed = 0;
    let failed = 0;
    const results = [];
    
    // Test safe images
    console.log('🟢 Testing SAFE Images (should NOT be flagged):\n');
    
    for (const test of TEST_IMAGES.safe) {
        console.log(`   Testing: ${test.name}`);
        console.log(`   URL: ${test.url.substring(0, 60)}...`);
        
        try {
            const startTime = Date.now();
            const result = await checkNSFW(test.url);
            const elapsed = Date.now() - startTime;
            
            const testPassed = result.isNsfw === test.expected;
            
            if (testPassed) {
                console.log(`   ✅ PASS (${elapsed}ms) - Correctly identified as SAFE`);
                console.log(`      Confidence: ${result.confidence?.toFixed(1) || 0}%`);
                passed++;
            } else {
                console.log(`   ❌ FAIL (${elapsed}ms) - Incorrectly flagged as NSFW!`);
                console.log(`      Confidence: ${result.confidence?.toFixed(1) || 0}%`);
                console.log(`      Reason: ${result.reason}`);
                failed++;
            }
            
            results.push({
                name: test.name,
                expected: test.expected,
                actual: result.isNsfw,
                passed: testPassed,
                confidence: result.confidence,
                reason: result.reason,
                latency: elapsed
            });
            
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            failed++;
            results.push({
                name: test.name,
                error: error.message,
                passed: false
            });
        }
        
        console.log('');
    }
    
    // Test batch check
    console.log('📦 Testing Batch Media Check...');
    try {
        const batchMedia = TEST_IMAGES.safe.slice(0, 3).map(t => ({
            url: t.url,
            type: 'image'
        }));
        
        const startTime = Date.now();
        const batchResults = await checkAllMedia(batchMedia);
        const elapsed = Date.now() - startTime;
        
        const allSafe = batchResults.every(r => !r.isNsfw);
        console.log(`   ${allSafe ? '✅' : '❌'} Batch check (${batchResults.length} images): ${elapsed}ms`);
        console.log(`   All safe: ${allSafe}`);
        
        if (allSafe) passed++;
        else failed++;
        
    } catch (error) {
        console.log(`   ❌ Batch check error: ${error.message}`);
        failed++;
    }
    
    // Summary
    console.log('\n========================================');
    console.log('📊 TEST SUMMARY');
    console.log('========================================');
    console.log(`   Total Tests: ${passed + failed}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('========================================\n');
    
    // Detailed results
    console.log('📋 Detailed Results:');
    results.forEach(r => {
        const status = r.passed ? '✅' : '❌';
        console.log(`   ${status} ${r.name}: ${r.passed ? 'PASS' : 'FAIL'} (${r.latency || 0}ms)`);
    });
    
    console.log('\n');
    
    if (failed === 0) {
        console.log('🎉 All tests passed! NSFW detection is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Review the results above.');
    }
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
