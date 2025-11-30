const { PutCommand, ScanCommand, UpdateCommand, DeleteCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const TABLE_NAME = "Buddylynk_Notifications";

const createNotification = async (notification) => {
    const newNotification = {
        notificationId: uuidv4(),
        createdAt: new Date().toISOString(),
        read: false,
        ...notification,
    };
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newNotification,
    }));
    return newNotification;
};

const getUserNotifications = async (userId) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "userId = :userId",
        ExpressionAttributeValues: {
            ":userId": userId,
        },
    });
    const response = await docClient.send(command);
    return response.Items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const markAsRead = async (notificationId) => {
    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { notificationId },
        UpdateExpression: "SET #read = :read",
        ExpressionAttributeNames: {
            "#read": "read",
        },
        ExpressionAttributeValues: {
            ":read": true,
        },
    }));
};

const clearAllNotifications = async (userId) => {
    // First, get all notifications for the user
    const notifications = await getUserNotifications(userId);
    
    if (notifications.length === 0) return;

    // Delete in batches of 25 (DynamoDB limit)
    const batchSize = 25;
    for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const deleteRequests = batch.map(notification => ({
            DeleteRequest: {
                Key: { notificationId: notification.notificationId }
            }
        }));

        await docClient.send(new BatchWriteCommand({
            RequestItems: {
                [TABLE_NAME]: deleteRequests
            }
        }));
    }
};

module.exports = { createNotification, getUserNotifications, markAsRead, clearAllNotifications };
