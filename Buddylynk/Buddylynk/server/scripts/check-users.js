const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const checkUsers = async () => {
    try {
        const command = new ScanCommand({
            TableName: "Buddylynk_Users",
        });
        const response = await docClient.send(command);
        console.log("Users in database:", response.Items.length);
        response.Items.forEach(user => {
            console.log(`- Email: ${user.email}, Username: ${user.username}`);
        });
    } catch (error) {
        console.error("Error:", error);
    }
};

checkUsers();
