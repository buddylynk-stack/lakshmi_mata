/**
 * Test NSFW Detection Accuracy
 * Run: node test-nsfw-accuracy.js
 */

require('dotenv').config();
const { checkNSFW } = require('./services/nsfwService');

// Test images - mix of safe and NSFW
const TEST_IMAGES = [
    // SAFE images - should NOT be flagged
    {
        name: 'Normal portrait',
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
        expected: false
    },
    {
        name: 'Beach photo (clothed)',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
        expected: false
    },
    {
        name: 'Fashion model',
        url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400',
        expected: false
    },
    {
        name: 'Fitness photo',
        url: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
        expected: false
    },
    {
        name: 'Swimsuit model',
        url: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400',
        expected: false
    }
];

async function runTests() {
    console.log('\n========================================');
    console.log('🧪 NSFW DETECTION ACCURACY TEST');
    console.log('========================================\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const test of TEST_IMAGES) {
        console.log(`\n📷 Testing: ${test.name}`);
        console.log(`   URL: ${test.url.substring(0, 50)}...`);
        console.log(`   Expected: ${test.expected ? 'NSFW' : 'SAFE'}`);
        
        try {
            const result = await checkNSFW(test.url);
            const correct = result.isNsfw === test.expected;
            
            if (correct) {
                console.log(`   ✅ CORRECT - Detected as ${result.isNsfw ? 'NSFW' : 'SAFE'}`);
                passed++;
            } else {
                console.log(`   ❌ WRONG - Detected as ${result.isNsfw ? 'NSFW' : 'SAFE'} (expected ${test.expected ? 'NSFW' : 'SAFE'})`);
                console.log(`      Reason: ${result.reason}`);
                console.log(`      Confidence: ${result.confidence?.toFixed(1) || 0}%`);
                failed++;
            }
            
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            failed++;
        }
        
        // Delay between tests
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log('\n========================================');
    console.log('📊 RESULTS');
    console.log('========================================');
    console.log(`✅ Passed: ${passed}/${TEST_IMAGES.length}`);
    console.log(`❌ Failed: ${failed}/${TEST_IMAGES.length}`);
    console.log(`📈 Accuracy: ${((passed / TEST_IMAGES.length) * 100).toFixed(1)}%`);
    console.log('========================================\n');
}

runTests().catch(console.error);
