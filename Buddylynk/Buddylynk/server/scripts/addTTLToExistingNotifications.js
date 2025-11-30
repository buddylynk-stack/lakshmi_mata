/**
 * Script to add TTL (expiresAt) to existing notifications
 * Run this once to update old notifications with TTL
 * 
 * Usage: node scripts/addTTLToExistingNotifications.js
 */

require('dotenv').config();
const { ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");

const TABLE_NAME = "Buddylynk_Notifications";
const TTL_DAYS = 7;

async function addTTLToExistingNotifications() {
    console.log("🔄 Scanning for notifications without TTL...");
    
    try {
        // Scan all notifications
        const scanResult = await docClient.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "attribute_not_exists(expiresAt)",
        }));

        const notifications = scanResult.Items || [];
        console.log(`📋 Found ${notifications.length} notifications without TTL`);

        if (notifications.length === 0) {
            console.log("✅ All notifications already have TTL set!");
            return;
        }

        let updated = 0;
        for (const notification of notifications) {
            // Calculate TTL based on createdAt date + 7 days
            const createdDate = new Date(notification.createdAt);
            const expiresAt = Math.floor(createdDate.getTime() / 1000) + (TTL_DAYS * 24 * 60 * 60);

            // Skip if already expired (will be deleted soon anyway)
            if (expiresAt < Math.floor(Date.now() / 1000)) {
                console.log(`⏭️  Skipping expired notification: ${notification.notificationId}`);
                continue;
            }

            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { notificationId: notification.notificationId },
                UpdateExpression: "SET expiresAt = :expiresAt",
                ExpressionAttributeValues: {
                    ":expiresAt": expiresAt,
                },
            }));
            updated++;
        }

        console.log(`✅ Successfully added TTL to ${updated} notifications`);
        console.log(`📅 Notifications will auto-delete ${TTL_DAYS} days after creation`);
    } catch (error) {
        console.error("❌ Error updating notifications:", error);
    }
}

addTTLToExistingNotifications();
