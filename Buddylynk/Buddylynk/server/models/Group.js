const { PutCommand, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const TABLE_NAME = "Buddylynk_Groups";

const createGroup = async (groupData) => {
    // Generate unique invite code for all channels (can be regenerated/revoked)
    const inviteCode = uuidv4().split('-')[0]; // Short 8-char code
    
    // Determine entity type: 'GROUP' or 'CHANNEL' for clear database separation
    const entityType = groupData.type === 'channel' ? 'CHANNEL' : 'GROUP';
    
    const newGroup = {
        groupId: uuidv4(),
        createdAt: new Date().toISOString(),
        members: [groupData.creatorId],
        memberCount: 1,
        posts: [],
        admins: [groupData.creatorId], // Creator is always admin
        ...groupData,
        // Entity type for database filtering (GROUP or CHANNEL)
        entityType: entityType,
        // Ensure type is set correctly after spread, with fallback to 'group'
        type: groupData.type || 'group',
        // Set visibility (public or private)
        visibility: groupData.visibility || 'public',
        // Allow members to chat toggle (default: true for groups, false for channels)
        allowMembersToChat: groupData.allowMembersToChat !== undefined 
            ? groupData.allowMembersToChat 
            : (groupData.type === 'channel' ? false : true),
        // Generate invite code for all channels (allows revokable links)
        inviteCode: inviteCode,
        inviteCodeCreatedAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newGroup,
    }));
    
    return newGroup;
};

// Get group by invite code (for private channel access)
const getGroupByInviteCode = async (inviteCode) => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "inviteCode = :code",
        ExpressionAttributeValues: {
            ":code": inviteCode
        }
    });
    const response = await docClient.send(command);
    return response.Items?.[0] || null;
};

const getAllGroups = async () => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
    });
    const response = await docClient.send(command);
    return response.Items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Get only Groups (entityType = 'GROUP')
const getOnlyGroups = async () => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "entityType = :entityType OR (attribute_not_exists(entityType) AND #type = :groupType)",
        ExpressionAttributeNames: {
            "#type": "type"
        },
        ExpressionAttributeValues: {
            ":entityType": "GROUP",
            ":groupType": "group"
        }
    });
    const response = await docClient.send(command);
    return response.Items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Get only Channels (entityType = 'CHANNEL')
const getOnlyChannels = async () => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "entityType = :entityType OR (attribute_not_exists(entityType) AND #type = :channelType)",
        ExpressionAttributeNames: {
            "#type": "type"
        },
        ExpressionAttributeValues: {
            ":entityType": "CHANNEL",
            ":channelType": "channel"
        }
    });
    const response = await docClient.send(command);
    return response.Items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getGroupById = async (groupId) => {
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { groupId },
    });
    const response = await docClient.send(command);
    
    // If group exists, ensure all required fields have defaults
    if (response.Item) {
        let needsUpdate = false;
        
        // Generate invite code if missing
        if (!response.Item.inviteCode || response.Item.inviteCode === null) {
            response.Item.inviteCode = uuidv4().split('-')[0];
            response.Item.inviteCodeCreatedAt = new Date().toISOString();
            needsUpdate = true;
        }
        
        // Set defaults for missing fields
        if (!response.Item.type) {
            response.Item.type = 'group';
            needsUpdate = true;
        }
        if (!response.Item.visibility) {
            response.Item.visibility = 'public';
            needsUpdate = true;
        }
        if (!response.Item.admins) {
            response.Item.admins = [response.Item.creatorId];
            needsUpdate = true;
        }
        
        // Set entityType based on type if not set (for database separation)
        if (!response.Item.entityType) {
            response.Item.entityType = response.Item.type === 'channel' ? 'CHANNEL' : 'GROUP';
            needsUpdate = true;
        }
        
        // Set allowMembersToChat default based on type if not set
        if (response.Item.allowMembersToChat === undefined) {
            // Default: true for groups, false for channels
            response.Item.allowMembersToChat = response.Item.type !== 'channel';
            needsUpdate = true;
        }
        
        // Save if any updates were made
        if (needsUpdate) {
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: response.Item,
            }));
        }
    }
    
    return response.Item;
};

const joinGroup = async (groupId, userId, bypassBan = false) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    if (group.members.includes(userId)) {
        throw new Error("Already a member");
    }
    
    // Check if user is banned (unless bypassing via new invite link)
    if (!bypassBan && group.bannedUsers?.includes(userId)) {
        throw new Error("You have been removed from this group and cannot rejoin");
    }
    
    group.members.push(userId);
    group.memberCount = group.members.length;
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

const leaveGroup = async (groupId, userId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    group.members = group.members.filter(id => id !== userId);
    group.memberCount = group.members.length;
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

const deleteGroup = async (groupId) => {
    await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { groupId },
    }));
};

// Regenerate invite code (revoke old link and create new one)
// This also clears the banned users list so they can rejoin with new link
const regenerateInviteCode = async (groupId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    // Store old invite code for logging
    const oldInviteCode = group.inviteCode;
    
    // Generate new invite code
    const newInviteCode = uuidv4().split('-')[0]; // Short 8-char code
    
    // Update group with new invite code
    group.inviteCode = newInviteCode;
    group.inviteCodeUpdatedAt = new Date().toISOString();
    group.type = group.type || 'group';
    group.visibility = group.visibility || 'public';
    group.admins = group.admins || [group.creatorId];
    
    // Clear banned users list - they can rejoin with new invite link
    group.bannedUsers = [];
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    console.log(`✅ Invite code regenerated for group ${groupId}: ${oldInviteCode} -> ${newInviteCode}`);
    console.log(`✅ Banned users list cleared for group ${groupId}`);
    
    return group;
};

const addPostToGroup = async (groupId, postData) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    // Clean postData - remove undefined values
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
    
    group.posts = [...(group.posts || []), newPost];
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

const editGroupPost = async (groupId, postId, userId, content) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    const postIndex = group.posts.findIndex(p => p.postId === postId);
    if (postIndex === -1) throw new Error("Post not found");
    
    // Check if user owns the post
    if (group.posts[postIndex].userId !== userId) {
        throw new Error("Not authorized to edit this post");
    }
    
    group.posts[postIndex].content = content;
    group.posts[postIndex].editedAt = new Date().toISOString();
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

const deleteGroupPost = async (groupId, postId, userId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    const post = group.posts.find(p => p.postId === postId);
    if (!post) throw new Error("Post not found");
    
    // Check if user owns the post or is the group creator
    if (post.userId !== userId && group.creatorId !== userId) {
        throw new Error("Not authorized to delete this post");
    }
    
    group.posts = group.posts.filter(p => p.postId !== postId);
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Update group details (name, description, coverImage, visibility, allowMembersToChat)
const updateGroup = async (groupId, updateData) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    // Update allowed fields
    if (updateData.name) group.name = updateData.name;
    if (updateData.description !== undefined) group.description = updateData.description;
    if (updateData.coverImage) group.coverImage = updateData.coverImage;
    if (updateData.visibility) group.visibility = updateData.visibility;
    if (updateData.privacy) group.privacy = updateData.privacy;
    if (updateData.allowMembersToChat !== undefined) group.allowMembersToChat = updateData.allowMembersToChat;
    
    group.updatedAt = new Date().toISOString();
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Add admin to group
const addAdmin = async (groupId, userId, requesterId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    // Only creator can add admins
    if (group.creatorId !== requesterId) {
        throw new Error("Only the creator can add admins");
    }
    
    // Check if user is a member
    if (!group.members.includes(userId)) {
        throw new Error("User must be a member first");
    }
    
    // Initialize admins array if not exists
    if (!group.admins) group.admins = [group.creatorId];
    
    // Check if already admin
    if (group.admins.includes(userId)) {
        throw new Error("User is already an admin");
    }
    
    group.admins.push(userId);
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Remove admin from group
const removeAdmin = async (groupId, userId, requesterId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    // Only creator can remove admins
    if (group.creatorId !== requesterId) {
        throw new Error("Only the creator can remove admins");
    }
    
    // Cannot remove creator from admins
    if (userId === group.creatorId) {
        throw new Error("Cannot remove the creator from admins");
    }
    
    group.admins = (group.admins || []).filter(id => id !== userId);
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Like a post in group
const likeGroupPost = async (groupId, postId, userId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    const postIndex = group.posts.findIndex(p => p.postId === postId);
    if (postIndex === -1) throw new Error("Post not found");
    
    const post = group.posts[postIndex];
    
    // Initialize likedBy if not exists
    if (!post.likedBy) post.likedBy = [];
    
    // Toggle like
    if (post.likedBy.includes(userId)) {
        post.likedBy = post.likedBy.filter(id => id !== userId);
        post.likes = Math.max(0, (post.likes || 0) - 1);
    } else {
        post.likedBy.push(userId);
        post.likes = (post.likes || 0) + 1;
    }
    
    group.posts[postIndex] = post;
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Vote on a poll
const voteOnPoll = async (groupId, postId, userId, optionIndex) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    const postIndex = group.posts.findIndex(p => p.postId === postId);
    if (postIndex === -1) throw new Error("Post not found");
    
    const post = group.posts[postIndex];
    
    if (post.type !== "poll") {
        throw new Error("This post is not a poll");
    }
    
    // Initialize poll votes if not exists
    if (!post.pollVotes) post.pollVotes = {};
    if (!post.voters) post.voters = [];
    
    // Check if user already voted
    if (post.voters.includes(userId)) {
        throw new Error("You have already voted on this poll");
    }
    
    // Record the vote
    const optionKey = `option_${optionIndex}`;
    post.pollVotes[optionKey] = (post.pollVotes[optionKey] || 0) + 1;
    post.voters.push(userId);
    
    group.posts[postIndex] = post;
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Add comment to group post
const addCommentToGroupPost = async (groupId, postId, commentData) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    const postIndex = group.posts.findIndex(p => p.postId === postId);
    if (postIndex === -1) throw new Error("Post not found");
    
    const newComment = {
        commentId: uuidv4(),
        createdAt: new Date().toISOString(),
        ...commentData
    };
    
    // Initialize comments array if not exists
    if (!group.posts[postIndex].comments) {
        group.posts[postIndex].comments = [];
    }
    
    group.posts[postIndex].comments.push(newComment);
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Delete comment from group post
const deleteCommentFromGroupPost = async (groupId, postId, commentId, userId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    const postIndex = group.posts.findIndex(p => p.postId === postId);
    if (postIndex === -1) throw new Error("Post not found");
    
    const comment = group.posts[postIndex].comments?.find(c => c.commentId === commentId);
    if (!comment) throw new Error("Comment not found");
    
    // Check if user owns the comment or is the group creator
    if (comment.userId !== userId && group.creatorId !== userId) {
        throw new Error("Not authorized to delete this comment");
    }
    
    group.posts[postIndex].comments = group.posts[postIndex].comments.filter(
        c => c.commentId !== commentId
    );
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Edit comment in group post
const editCommentInGroupPost = async (groupId, postId, commentId, userId, content) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    const postIndex = group.posts.findIndex(p => p.postId === postId);
    if (postIndex === -1) throw new Error("Post not found");
    
    const commentIndex = group.posts[postIndex].comments?.findIndex(c => c.commentId === commentId);
    if (commentIndex === -1) throw new Error("Comment not found");
    
    const comment = group.posts[postIndex].comments[commentIndex];
    
    // Check if user owns the comment
    if (comment.userId !== userId) {
        throw new Error("Not authorized to edit this comment");
    }
    
    group.posts[postIndex].comments[commentIndex].content = content;
    group.posts[postIndex].comments[commentIndex].editedAt = new Date().toISOString();
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    return group;
};

// Get group members with user details
const getGroupMembers = async (groupId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    return {
        members: group.members || [],
        admins: group.admins || [group.creatorId],
        creatorId: group.creatorId,
        memberCount: group.memberCount || group.members?.length || 0
    };
};

// Remove member from group (kick) - adds to banned list
const removeMember = async (groupId, targetUserId, requesterId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    // Only creator or admins can remove members
    const isCreator = group.creatorId === requesterId;
    const isAdmin = group.admins?.includes(requesterId);
    
    if (!isCreator && !isAdmin) {
        throw new Error("Only creator or admins can remove members");
    }
    
    // Cannot remove the creator
    if (targetUserId === group.creatorId) {
        throw new Error("Cannot remove the creator");
    }
    
    // Admins cannot remove other admins (only creator can)
    if (!isCreator && group.admins?.includes(targetUserId)) {
        throw new Error("Only the creator can remove admins");
    }
    
    // Remove from members
    group.members = group.members.filter(id => id !== targetUserId);
    group.memberCount = group.members.length;
    
    // Also remove from admins if they were an admin
    if (group.admins) {
        group.admins = group.admins.filter(id => id !== targetUserId);
    }
    
    // Add to banned users list (prevents rejoining until invite link is regenerated)
    if (!group.bannedUsers) group.bannedUsers = [];
    if (!group.bannedUsers.includes(targetUserId)) {
        group.bannedUsers.push(targetUserId);
    }
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    console.log(`✅ User ${targetUserId} removed and banned from group ${groupId}`);
    
    return group;
};

// Unban a user (allow them to rejoin)
const unbanUser = async (groupId, targetUserId, requesterId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    // Only creator or admins can unban
    const isCreator = group.creatorId === requesterId;
    const isAdmin = group.admins?.includes(requesterId);
    
    if (!isCreator && !isAdmin) {
        throw new Error("Only creator or admins can unban users");
    }
    
    // Remove from banned list
    group.bannedUsers = (group.bannedUsers || []).filter(id => id !== targetUserId);
    
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: group,
    }));
    
    console.log(`✅ User ${targetUserId} unbanned from group ${groupId}`);
    
    return group;
};

// Get banned users list
const getBannedUsers = async (groupId) => {
    const group = await getGroupById(groupId);
    if (!group) throw new Error("Group not found");
    
    return group.bannedUsers || [];
};

module.exports = {
    createGroup,
    getAllGroups,
    getOnlyGroups,
    getOnlyChannels,
    getGroupById,
    getGroupByInviteCode,
    joinGroup,
    leaveGroup,
    deleteGroup,
    regenerateInviteCode,
    addPostToGroup,
    editGroupPost,
    deleteGroupPost,
    updateGroup,
    addAdmin,
    removeAdmin,
    likeGroupPost,
    voteOnPoll,
    addCommentToGroupPost,
    deleteCommentFromGroupPost,
    editCommentInGroupPost,
    getGroupMembers,
    removeMember,
    unbanUser,
    getBannedUsers
};
