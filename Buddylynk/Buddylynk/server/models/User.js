const { PutCommand, GetCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const TABLE_NAME = "Buddylynk_Users";

const createUser = async (user) => {
    const newUser = {
        userId: uuidv4(),
        createdAt: new Date().toISOString(),
        ...user,
    };
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newUser,
    }));
    return newUser;
};

const getUserByEmail = async (email) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
            ":email": email,
        },
    });
    const response = await docClient.send(command);
    return response.Items[0];
};

const getUserById = async (userId) => {
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId },
    });
    const response = await docClient.send(command);
    return response.Item;
};

const getUserByUsername = async (username) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "username = :username",
        ExpressionAttributeValues: {
            ":username": username,
        },
    });
    const response = await docClient.send(command);
    return response.Items[0];
};

module.exports = { createUser, getUserByEmail, getUserById, getUserByUsername };
