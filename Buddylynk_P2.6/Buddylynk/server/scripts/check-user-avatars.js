const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const checkUserAvatars = async () => {
    try {
        console.log("Checking user avatars...\n");
        
        const command = new ScanCommand({
            TableName: "Buddylynk_Users",
        });
        const response = await docClient.send(command);
        
        console.log(`Total users: ${response.Items.length}\n`);
        
        response.Items.forEach((user, index) => {
            console.log(`User ${index + 1}:`);
            console.log(`  Username: ${user.username}`);
            console.log(`  User ID: ${user.userId}`);
            console.log(`  Avatar: ${user.avatar || 'NOT SET'}`);
            console.log(`  Avatar in S3: ${user.avatar?.includes('s3.amazonaws.com') ? 'YES' : 'NO'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error("Error:", error.message);
    }
};

checkUserAvatars();
