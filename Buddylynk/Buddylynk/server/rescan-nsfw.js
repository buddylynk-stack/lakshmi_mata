/**
 * Script to rescan all posts for NSFW content
 * Run with: node rescan-nsfw.js
 */

require('dotenv').config();
const axios = require('axios');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

// You need to get a valid JWT token from a logged-in admin user
// For testing, you can get this from localStorage in browser dev tools
const AUTH_TOKEN = process.argv[2];

if (!AUTH_TOKEN) {
    console.log('Usage: node rescan-nsfw.js <auth_token>');
    console.log('');
    console.log('To get auth token:');
    console.log('1. Login to Buddylynk in browser');
    console.log('2. Open DevTools (F12) -> Application -> Local Storage');
    console.log('3. Copy the "token" value');
    console.log('');
    console.log('Or run the rescan directly via API:');
    console.log(`curl -X POST ${SERVER_URL}/api/posts/admin/rescan-nsfw -H "Authorization: Bearer <token>"`);
    process.exit(1);
}

async function rescanPosts() {
    console.log('\n🔄 Starting NSFW rescan...');
    console.log(`📡 Server: ${SERVER_URL}`);
    
    try {
        const response = await axios.post(
            `${SERVER_URL}/api/posts/admin/rescan-nsfw`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 300000 // 5 minutes timeout for large databases
            }
        );
        
        console.log('\n✅ Rescan complete!');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('\n❌ Rescan failed:', error.response?.data || error.message);
    }
}

rescanPosts();
