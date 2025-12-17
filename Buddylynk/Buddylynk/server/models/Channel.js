const { PutCommand, ScanCommand, GetCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const TABLE_NAME = "Buddylynk_Channels";

const createChannel = async (channelData) => {
    const inviteCode = uuidv4().split('-')[0];
    
    const newChannel = {
        channelId: uuidv4(),
        createdAt: new Date().toISOString(),
        members: [channelData.creatorId],
        memberCount: 1,
        posts: [],
        admins: [channelData.creatorId],
        bannedUsers: [],
        ...channelData,
        type: 'channel',
        visibility: channelData.visibility || 'public',
        // Channels: only admins can post by default
        allowMembersToChat: false,
        inviteCode: inviteCode,
        inviteCodeCreatedAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newChannel,
    }));
    
    return newChannel;
};

const getChannelByInviteCode = async (inviteCode) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "inviteCode = :code",
        ExpressionAttributeValues: { ":code": inviteCode }
    });
    const response = await docClient.send(command);
    return response.Items?.[0] || null;
};

const getAllChannels = async () => {
    const command = new ScanCommand({ TableName: TABLE_NAME });
    const response = await docClient.send(command);
    return response.Items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getChannelById = async (channelId) => {
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { channelId },
    });
    const response = await docClient.send(command);
    
    if (response.Item) {
        let needsUpdate = false;
        
        if (!response.Item.inviteCode) {
            response.Item.inviteCode = uuidv4().split('-')[0];
            response.Item.inviteCodeCreatedAt = new Date().toISOString();
            needsUpdate = true;
        }
        if (!response.Item.admins) {
            response.Item.admins = [response.Item.creatorId];
            needsUpdate = true;
        }
        if (!response.Item.bannedUsers) {
            response.Item.bannedUsers = [];
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: response.Item,
            }));
        }
    }
    
    return response.Item;
};

const joinChannel = async (channelId, userId, bypassBan = false) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    if (channel.members.includes(userId)) {
        throw new Error("Already a member");
    }
    
    if (!bypassBan && channel.bannedUsers?.includes(userId)) {
        throw new Error("You have been removed from this channel and cannot rejoin");
    }
    
    channel.members.push(userId);
    channel.memberCount = channel.members.length;
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const leaveChannel = async (channelId, userId) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    channel.members = channel.members.filter(id => id !== userId);
    channel.memberCount = channel.members.length;
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const deleteChannel = async (channelId) => {
    await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { channelId },
    }));
};

const regenerateInviteCode = async (channelId) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    channel.inviteCode = uuidv4().split('-')[0];
    channel.inviteCodeUpdatedAt = new Date().toISOString();
    channel.bannedUsers = []; // Clear banned users on new invite
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const updateChannel = async (channelId, updateData) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    if (updateData.name) channel.name = updateData.name;
    if (updateData.description !== undefined) channel.description = updateData.description;
    if (updateData.coverImage) channel.coverImage = updateData.coverImage;
    if (updateData.visibility) channel.visibility = updateData.visibility;
    
    channel.updatedAt = new Date().toISOString();
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const addPostToChannel = async (channelId, postData) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    const cleanPostData = Object.fromEntries(
        Object.entries(postData).filter(([_, v]) => v !== undefined && v !== null)
    );
    
    const newPost = {
        postId: uuidv4(),
        createdAt: new Date().toISOString(),
        likes: 0,
        likedBy: [],
        comments: [],
        ...cleanPostData,
    };
    
    channel.posts = [newPost, ...(channel.posts || [])];
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const addAdmin = async (channelId, userId, requesterId) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    if (channel.creatorId !== requesterId) {
        throw new Error("Only the creator can add admins");
    }
    
    if (!channel.members.includes(userId)) {
        throw new Error("User must be a member first");
    }
    
    if (!channel.admins) channel.admins = [channel.creatorId];
    if (channel.admins.includes(userId)) {
        throw new Error("User is already an admin");
    }
    
    channel.admins.push(userId);
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const removeAdmin = async (channelId, userId, requesterId) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    if (channel.creatorId !== requesterId) {
        throw new Error("Only the creator can remove admins");
    }
    
    if (userId === channel.creatorId) {
        throw new Error("Cannot remove the creator from admins");
    }
    
    channel.admins = (channel.admins || []).filter(id => id !== userId);
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const removeMember = async (channelId, targetUserId, requesterId) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    const isCreator = channel.creatorId === requesterId;
    const isAdmin = channel.admins?.includes(requesterId);
    
    if (!isCreator && !isAdmin) {
        throw new Error("Only creator or admins can remove members");
    }
    
    if (targetUserId === channel.creatorId) {
        throw new Error("Cannot remove the creator");
    }
    
    if (!isCreator && channel.admins?.includes(targetUserId)) {
        throw new Error("Only the creator can remove admins");
    }
    
    channel.members = channel.members.filter(id => id !== targetUserId);
    channel.memberCount = channel.members.length;
    
    if (channel.admins) {
        channel.admins = channel.admins.filter(id => id !== targetUserId);
    }
    
    if (!channel.bannedUsers) channel.bannedUsers = [];
    if (!channel.bannedUsers.includes(targetUserId)) {
        channel.bannedUsers.push(targetUserId);
    }
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const unbanUser = async (channelId, targetUserId, requesterId) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    const isCreator = channel.creatorId === requesterId;
    const isAdmin = channel.admins?.includes(requesterId);
    
    if (!isCreator && !isAdmin) {
        throw new Error("Only creator or admins can unban users");
    }
    
    channel.bannedUsers = (channel.bannedUsers || []).filter(id => id !== targetUserId);
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: channel,
    }));
    
    return channel;
};

const getBannedUsers = async (channelId) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    return channel.bannedUsers || [];
};

const getChannelMembers = async (channelId) => {
    const channel = await getChannelById(channelId);
    if (!channel) throw new Error("Channel not found");
    
    return {
        members: channel.members || [],
        admins: channel.admins || [channel.creatorId],
        creatorId: channel.creatorId,
        memberCount: channel.memberCount || channel.members?.length || 0
    };
};

module.exports = {
    createChannel,
    getAllChannels,
    getChannelById,
    getChannelByInviteCode,
    joinChannel,
    leaveChannel,
    deleteChannel,
    regenerateInviteCode,
    updateChannel,
    addPostToChannel,
    addAdmin,
    removeAdmin,
    removeMember,
    unbanUser,
    getBannedUsers,
    getChannelMembers
};
