const { PutCommand, ScanCommand, QueryCommand, DeleteCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const TABLE_NAME = "Buddylynk_Messages";

const createMessage = async (message) => {
    const newMessage = {
        messageId: uuidv4(),
        createdAt: new Date().toISOString(),
        ...message,
    };
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newMessage,
    }));
    return newMessage;
};

const getConversation = async (userId1, userId2) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "(senderId = :user1 AND receiverId = :user2) OR (senderId = :user2 AND receiverId = :user1)",
        ExpressionAttributeValues: {
            ":user1": userId1,
            ":user2": userId2,
        },
    });
    const response = await docClient.send(command);
    return response.Items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const getUserConversations = async (userId) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "senderId = :userId OR receiverId = :userId",
        ExpressionAttributeValues: {
            ":userId": userId,
        },
    });
    const response = await docClient.send(command);

    // Group messages by conversation partner
    const conversations = {};
    response.Items.forEach(msg => {
        const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        if (!conversations[partnerId]) {
            conversations[partnerId] = [];
        }
        conversations[partnerId].push(msg);
    });

    // Get the last message for each conversation
    const conversationList = Object.entries(conversations).map(([partnerId, messages]) => {
        const sortedMessages = messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return {
            partnerId,
            lastMessage: sortedMessages[0],
            unreadCount: sortedMessages.filter(m => !m.read && m.receiverId === userId).length,
        };
    });

    return conversationList.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
};

const markMessagesAsRead = async (currentUserId, otherUserId) => {
    // Get all unread messages from otherUser to currentUser
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "senderId = :otherUser AND receiverId = :currentUser AND #read = :falseVal",
        ExpressionAttributeNames: {
            "#read": "read"
        },
        ExpressionAttributeValues: {
            ":otherUser": otherUserId,
            ":currentUser": currentUserId,
            ":falseVal": false,
        },
    });

    const response = await docClient.send(command);

    // Mark each message as read
    for (const message of response.Items || []) {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: { ...message, read: true },
        }));
    }
};

const getMessageById = async (messageId) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "messageId = :messageId",
        ExpressionAttributeValues: {
            ":messageId": messageId,
        },
    });
    const response = await docClient.send(command);
    return response.Items?.[0] || null;
};

const updateMessage = async (messageId, content) => {
    // First get the message to update
    const message = await getMessageById(messageId);
    if (!message) return null;
    
    // Update with new content
    const updatedMessage = {
        ...message,
        content,
        edited: true,
        editedAt: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedMessage,
    }));
    
    return updatedMessage;
};

const deleteMessage = async (messageId) => {
    // First get the message to find its key
    const message = await getMessageById(messageId);
    if (!message) return false;
    
    // Delete the message
    await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
            messageId: message.messageId
        }
    }));
    
    return true;
};

module.exports = { createMessage, getConversation, getUserConversations, markMessagesAsRead, getMessageById, updateMessage, deleteMessage };
