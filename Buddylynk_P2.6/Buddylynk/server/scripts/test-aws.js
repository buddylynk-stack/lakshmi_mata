const { ListBucketsCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const testAWS = async () => {
    console.log("Testing AWS Connection...\n");
    
    // Test S3
    try {
        console.log("1. Testing S3 Connection...");
        const command = new ListBucketsCommand({});
        const response = await s3Client.send(command);
        console.log("✅ S3 Connected successfully!");
        console.log(`   Found ${response.Buckets.length} buckets`);
    } catch (error) {
        console.log("❌ S3 Connection failed:");
        console.log("   Error:", error.message);
    }
    
    // Test DynamoDB
    try {
        console.log("\n2. Testing DynamoDB Connection...");
        const command = new ScanCommand({
            TableName: "Buddylynk_Posts",
            Limit: 1
        });
        const response = await docClient.send(command);
        console.log("✅ DynamoDB Connected successfully!");
        console.log(`   Can access Buddylynk_Posts table`);
    } catch (error) {
        console.log("❌ DynamoDB Connection failed:");
        console.log("   Error:", error.message);
    }
    
    // Test environment variables
    console.log("\n3. Checking Environment Variables...");
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ SET' : '❌ NOT SET'}`);
};

testAWS();
