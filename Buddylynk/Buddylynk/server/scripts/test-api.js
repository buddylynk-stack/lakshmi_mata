const http = require("http");

const testAPI = async () => {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/posts',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            const posts = JSON.parse(data);
            console.log("Total posts:", posts.length);
            console.log("\nFirst post:");
            console.log(JSON.stringify(posts[0], null, 2));
            
            console.log("\n\nChecking all posts for createdAt:");
            posts.forEach((post, index) => {
                console.log(`Post ${index + 1}: createdAt = ${post.createdAt || 'MISSING'}`);
            });
        });
    });

    req.on('error', (error) => {
        console.error("Error:", error.message);
    });

    req.end();
};

testAPI();
