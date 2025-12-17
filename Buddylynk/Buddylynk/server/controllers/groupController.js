const Group = require("../models/Group");
const { uploadToS3 } = require("../middleware/uploadMiddleware");

const createGroup = async (req, res) => {
    console.log("📥 Create group request received");
    console.log("📝 Request body:", req.body);
    console.log("📷 Request file:", req.file ? req.file.originalname : "No file");
    console.log("👤 User:", req.user ? { userId: req.user.userId, username: req.user.username } : "No user");
    
    try {
        const { name, description, type, visibility } = req.body;
        
        if (!name || !name.trim()) {
            console.error("❌ Validation failed: name is required");
            return res.status(400).json({ message: "Group name is required" });
        }
        
        let coverImage = null;

        if (req.file) {
            console.log("📤 Uploading cover image to S3...");
            coverImage = await uploadToS3(req.file);
            console.log("✅ Cover image uploaded:", coverImage);
        }

        // Log the received type and visibility
        console.log("📋 Received type from frontend:", type);
        console.log("📋 Received visibility from frontend:", visibility);
        
        const groupData = {
            name: name.trim(),
            description: description ? description.trim() : "",
            coverImage,
            creatorId: req.user.userId,
            creatorName: req.user.username,
            type: type === 'channel' ? 'channel' : 'group', // Ensure only 'channel' or 'group'
            visibility: visibility === 'private' ? 'private' : 'public', // Ensure only 'private' or 'public'
        };

        console.log("💾 Creating group in DynamoDB with data:", groupData);
        const newGroup = await Group.createGroup(groupData);
        
        // Broadcast new group via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_CREATED, newGroup);
        
        console.log(`✅ Group created successfully: ${newGroup.groupId}`);
        
        res.status(201).json(newGroup);
    } catch (error) {
        console.error("❌ Error creating group:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

const getAllGroups = async (req, res) => {
    try {
        const allGroups = await Group.getAllGroups();
        const userId = req.user?.userId;
        
        // Return all public groups + private groups where user is creator/member
        // This allows:
        // - Joined tab: shows groups user is member of (public + private)
        // - Discover tab: shows public groups user hasn't joined (filtered on frontend)
        const visibleGroups = allGroups.filter(group => {
            // Public groups are always visible (for discover)
            if (group.visibility !== 'private') {
                return true;
            }
            // Private groups: only visible to creator or members
            const isCreator = group.creatorId === userId;
            const isMember = group.members?.includes(userId);
            return isCreator || isMember;
        });
        
        console.log(`📋 Returning ${visibleGroups.length} visible groups out of ${allGroups.length} total`);
        res.json(visibleGroups);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get only Groups (not channels)
const getOnlyGroups = async (req, res) => {
    try {
        const groups = await Group.getOnlyGroups();
        const userId = req.user?.userId;
        
        // Filter out private groups that the user doesn't own or isn't a member of
        const visibleGroups = groups.filter(group => {
            if (group.visibility !== 'private') {
                return true;
            }
            return group.creatorId === userId || group.members?.includes(userId);
        });
        
        res.json(visibleGroups);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get only Channels (not groups)
const getOnlyChannels = async (req, res) => {
    try {
        const channels = await Group.getOnlyChannels();
        const userId = req.user?.userId;
        
        // Filter out private channels that the user doesn't own or isn't a member of
        const visibleChannels = channels.filter(channel => {
            if (channel.visibility !== 'private') {
                return true;
            }
            return channel.creatorId === userId || channel.members?.includes(userId);
        });
        
        res.json(visibleChannels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await Group.getGroupById(id);
        
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }
        
        const userId = req.user?.userId;
        const isCreator = group.creatorId === userId;
        const isMember = group.members?.includes(userId);
        
        // For Telegram-style channels: hide member list, only return count
        // Members array is kept internally for join/leave logic but not exposed
        const sanitizedGroup = {
            ...group,
            memberCount: group.members?.length || 0,
            // Don't expose the full members array - only count
            // Keep members array only for checking if current user is a member
            members: group.members || [],
            // Include invite code for creator (allows revokable invite links)
            inviteCode: isCreator ? group.inviteCode : null,
            // Flag to indicate if user can view content (for private channels)
            canView: group.visibility !== 'private' || isCreator || isMember,
        };
        
        res.json(sanitizedGroup);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get group by invite code (for private channel access via invite link)
const getGroupByInvite = async (req, res) => {
    try {
        const { inviteCode } = req.params;
        const group = await Group.getGroupByInviteCode(inviteCode);
        
        if (!group) {
            return res.status(404).json({ message: "Invalid invite link" });
        }
        
        const userId = req.user?.userId;
        const isMember = group.members?.includes(userId);
        
        // Return limited info for preview (like Telegram)
        // For public channels, show recent posts preview even for non-members
        let previewPosts = [];
        if (isMember) {
            previewPosts = group.posts || [];
        } else if (group.visibility === 'public' || group.type === 'channel') {
            // Show last 20 posts for preview (like Telegram public channels)
            previewPosts = (group.posts || []).slice(0, 20).map(post => ({
                postId: post.postId,
                content: post.content,
                media: post.media,
                createdAt: post.createdAt,
                username: post.username,
                // Don't expose likes/comments for non-members
            }));
        }
        
        const previewGroup = {
            groupId: group.groupId,
            name: group.name,
            description: group.description,
            coverImage: group.coverImage,
            type: group.type,
            visibility: group.visibility,
            memberCount: group.members?.length || 0,
            creatorName: group.creatorName,
            isMember,
            posts: previewPosts,
            members: group.members || [],
        };
        
        res.json(previewGroup);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Join via invite code (bypasses ban check - new invite link allows banned users to rejoin)
const joinByInvite = async (req, res) => {
    try {
        const { inviteCode } = req.params;
        const userId = req.user.userId;
        
        const group = await Group.getGroupByInviteCode(inviteCode);
        
        if (!group) {
            return res.status(404).json({ message: "Invalid invite link" });
        }
        
        // Check if user is banned - if so, they need a NEW invite link
        // The invite code in the URL must match the current group's invite code
        // If the creator regenerated the link, banned users can join with the new link
        const isBanned = group.bannedUsers?.includes(userId);
        
        if (isBanned) {
            // User is banned but has a valid current invite link
            // This means the creator shared the link after banning, so allow join
            // First, remove from banned list since they have a valid new invite
            group.bannedUsers = group.bannedUsers.filter(id => id !== userId);
        }
        
        // Use existing join logic (bypass ban since we handled it above)
        const updatedGroup = await Group.joinGroup(group.groupId, userId, true);
        
        // Broadcast group update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: group.groupId,
            group: updatedGroup,
            action: 'join',
            userId
        });
        
        console.log(`✅ User ${userId} joined private channel ${group.groupId} via invite`);
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

const updateGroup = async (req, res) => {
    console.log("📥 Update group request received");
    console.log("📝 Request body:", req.body);
    console.log("📷 Request file:", req.file ? req.file.originalname : "No file");
    console.log("🔄 allowMembersToChat received:", req.body.allowMembersToChat, "type:", typeof req.body.allowMembersToChat);
    
    try {
        const { id } = req.params;
        const { name, description, privacy, allowMembersToChat } = req.body;
        
        // Get existing group
        const existingGroup = await Group.getGroupById(id);
        if (!existingGroup) {
            return res.status(404).json({ message: "Group not found" });
        }
        
        // Check if user is the creator
        if (existingGroup.creatorId !== req.user.userId) {
            return res.status(403).json({ message: "Only the creator can edit this group" });
        }
        
        let coverImage = existingGroup.coverImage;
        
        // Upload new cover image if provided
        if (req.file) {
            console.log("📤 Uploading new cover image to S3...");
            coverImage = await uploadToS3(req.file);
            console.log("✅ New cover image uploaded:", coverImage);
        }
        
        // Parse allowMembersToChat properly (FormData sends strings)
        let parsedAllowMembersToChat = existingGroup.allowMembersToChat;
        if (allowMembersToChat !== undefined && allowMembersToChat !== null && allowMembersToChat !== '') {
            // Handle both boolean and string values
            if (typeof allowMembersToChat === 'boolean') {
                parsedAllowMembersToChat = allowMembersToChat;
            } else if (typeof allowMembersToChat === 'string') {
                parsedAllowMembersToChat = allowMembersToChat.toLowerCase() === 'true';
            }
        }
        
        console.log("🔄 Parsed allowMembersToChat:", parsedAllowMembersToChat, "from:", allowMembersToChat, "type:", typeof allowMembersToChat);
        
        // Update group data
        const updatedGroup = {
            ...existingGroup,
            name: name ? name.trim() : existingGroup.name,
            description: description !== undefined ? description.trim() : existingGroup.description,
            privacy: privacy || existingGroup.privacy || "public",
            allowMembersToChat: parsedAllowMembersToChat,
            coverImage,
            updatedAt: new Date().toISOString()
        };
        
        // Save to database
        const { PutCommand } = require("@aws-sdk/lib-dynamodb");
        const { docClient } = require("../config/db");
        
        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Groups",
            Item: updatedGroup,
        }));
        
        // Broadcast update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'edit'
        });
        
        console.log(`✅ Group updated successfully: ${id}`);
        
        res.json(updatedGroup);
    } catch (error) {
        console.error("❌ Error updating group:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

const joinGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        const updatedGroup = await Group.joinGroup(id, userId);
        
        // Broadcast group update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'join',
            userId
        });
        
        console.log(`✅ User ${userId} joined group ${id}`);
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

const leaveGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        const updatedGroup = await Group.leaveGroup(id, userId);
        
        // Broadcast group update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'leave',
            userId
        });
        
        console.log(`✅ User ${userId} left group ${id}`);
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        await Group.deleteGroup(id);
        
        // Broadcast group deletion via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_DELETED, id);
        
        console.log(`✅ Group deleted: ${id}`);
        
        res.json({ message: "Group deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const addPostToGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, type, pollOptions } = req.body;
        const userId = req.user.userId;

        // Get the group to check permissions
        const group = await Group.getGroupById(id);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check permissions based on group type and allowMembersToChat setting
        const isOwner = group.creatorId === userId;
        const isAdmin = group.admins?.includes(userId);
        const isMember = group.members?.includes(userId);
        const isChannel = group.type === 'channel';
        
        // Channels: ONLY admin/creator can post (always, regardless of settings)
        // Groups: Check allowMembersToChat setting
        if (isChannel) {
            // Channels: only owner/admins can post
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ message: "Only admins can send messages in this channel" });
            }
        } else {
            // Groups: check allowMembersToChat setting
            const allowMembersToChat = group.allowMembersToChat !== false; // Default to true if not set
            
            if (allowMembersToChat) {
                // All members can post
                if (!isMember) {
                    return res.status(403).json({ message: "You must be a member to post in this group" });
                }
            } else {
                // Only owner/admins can post
                if (!isOwner && !isAdmin) {
                    return res.status(403).json({ message: "Only admins can send messages in this group" });
                }
            }
        }

        let mediaArray = [];

        // Handle multiple media uploads
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const mediaUrl = await uploadToS3(file);
                
                // Detect media type
                let mediaType = 'document';
                if (file.mimetype.startsWith('image/')) {
                    mediaType = 'image';
                } else if (file.mimetype.startsWith('video/')) {
                    mediaType = 'video';
                } else if (file.mimetype.startsWith('audio/')) {
                    mediaType = 'audio';
                }
                
                mediaArray.push({
                    url: mediaUrl,
                    type: mediaType,
                    name: file.originalname
                });
            }
        }
        
        const postData = {
            userId: req.user.userId,
            username: req.user.username,
            content,
            type: type || "text",
            media: mediaArray.length > 0 ? mediaArray : undefined,
        };

        // Add poll data if it's a poll
        if (type === "poll" && pollOptions) {
            postData.pollOptions = Array.isArray(pollOptions) ? pollOptions : JSON.parse(pollOptions);
        }
        
        const updatedGroup = await Group.addPostToGroup(id, postData);
        
        // Broadcast group update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'newPost'
        });
        
        console.log(`✅ Post added to group ${id}`);
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const editGroupPost = async (req, res) => {
    try {
        const { id, postId } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;
        
        const updatedGroup = await Group.editGroupPost(id, postId, userId, content);
        
        // Broadcast group update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'editPost',
            postId
        });
        
        console.log(`✅ Post ${postId} edited in group ${id}`);
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

const deleteGroupPost = async (req, res) => {
    try {
        const { id, postId } = req.params;
        const userId = req.user.userId;
        
        const updatedGroup = await Group.deleteGroupPost(id, postId, userId);
        
        // Broadcast group update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'deletePost',
            postId
        });
        
        console.log(`✅ Post ${postId} deleted from group ${id}`);
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

// Regenerate invite link (revoke old and create new)
const regenerateInviteLink = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        // Get existing group
        const existingGroup = await Group.getGroupById(id);
        if (!existingGroup) {
            return res.status(404).json({ message: "Group not found" });
        }
        
        // Check if user is the creator
        if (existingGroup.creatorId !== userId) {
            return res.status(403).json({ message: "Only the creator can regenerate invite links" });
        }
        
        // Regenerate the invite code
        const updatedGroup = await Group.regenerateInviteCode(id);
        
        // Broadcast group update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'inviteRegenerated'
        });
        
        console.log(`✅ Invite link regenerated for group ${id}`);
        
        // Return sanitized group with new invite link
        const sanitizedGroup = {
            ...updatedGroup,
            memberCount: updatedGroup.members?.length || 0,
            inviteLink: updatedGroup.inviteCode ? `/invite/${updatedGroup.inviteCode}` : null,
        };
        
        res.json(sanitizedGroup);
    } catch (error) {
        console.error("❌ Error regenerating invite link:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

// Add admin to group
const addAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: targetUserId } = req.body;
        const requesterId = req.user.userId;
        
        const updatedGroup = await Group.addAdmin(id, targetUserId, requesterId);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'adminAdded',
            targetUserId
        });
        
        console.log(`✅ Admin added to group ${id}: ${targetUserId}`);
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

// Remove admin from group
const removeAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: targetUserId } = req.body;
        const requesterId = req.user.userId;
        
        const updatedGroup = await Group.removeAdmin(id, targetUserId, requesterId);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'adminRemoved',
            targetUserId
        });
        
        console.log(`✅ Admin removed from group ${id}: ${targetUserId}`);
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

// Like a post in group
const likeGroupPost = async (req, res) => {
    try {
        const { id, postId } = req.params;
        const userId = req.user.userId;
        
        const updatedGroup = await Group.likeGroupPost(id, postId, userId);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'postLiked',
            postId,
            userId
        });
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

// Vote on a poll
const voteOnPoll = async (req, res) => {
    try {
        const { id, postId } = req.params;
        const { optionIndex } = req.body;
        const userId = req.user.userId;
        
        const updatedGroup = await Group.voteOnPoll(id, postId, userId, optionIndex);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'pollVoted',
            postId,
            userId
        });
        
        console.log(`✅ User ${userId} voted on poll ${postId} in group ${id}`);
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message || "Server error" });
    }
};

// Add comment to group post
const addCommentToGroupPost = async (req, res) => {
    try {
        const { id, postId } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;
        const username = req.user.username;
        
        const commentData = {
            userId,
            username,
            content
        };
        
        const updatedGroup = await Group.addCommentToGroupPost(id, postId, commentData);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'commentAdded',
            postId
        });
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

// Delete comment from group post
const deleteCommentFromGroupPost = async (req, res) => {
    try {
        const { id, postId, commentId } = req.params;
        const userId = req.user.userId;
        
        const updatedGroup = await Group.deleteCommentFromGroupPost(id, postId, commentId, userId);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'commentDeleted',
            postId,
            commentId
        });
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

// Edit comment in group post
const editCommentInGroupPost = async (req, res) => {
    try {
        const { id, postId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;
        
        const updatedGroup = await Group.editCommentInGroupPost(id, postId, commentId, userId, content);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'commentEdited',
            postId,
            commentId
        });
        
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

// Get group members
const getGroupMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const membersData = await Group.getGroupMembers(id);
        res.json(membersData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

// Remove member from group (kick) - also bans them
const removeMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: targetUserId } = req.body;
        const requesterId = req.user.userId;
        
        const updatedGroup = await Group.removeMember(id, targetUserId, requesterId);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'memberRemoved',
            targetUserId
        });
        
        console.log(`✅ Member ${targetUserId} removed and banned from group ${id}`);
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

// Unban a user from group
const unbanUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: targetUserId } = req.body;
        const requesterId = req.user.userId;
        
        const updatedGroup = await Group.unbanUser(id, targetUserId, requesterId);
        
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.GROUP_UPDATED, {
            groupId: id,
            group: updatedGroup,
            action: 'userUnbanned',
            targetUserId
        });
        
        console.log(`✅ User ${targetUserId} unbanned from group ${id}`);
        res.json(updatedGroup);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

// Get banned users list
const getBannedUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const bannedUsers = await Group.getBannedUsers(id);
        res.json({ bannedUsers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

module.exports = {
    createGroup,
    getAllGroups,
    getOnlyGroups,
    getOnlyChannels,
    getGroupById,
    getGroupByInvite,
    joinByInvite,
    updateGroup,
    joinGroup,
    leaveGroup,
    deleteGroup,
    addPostToGroup,
    editGroupPost,
    deleteGroupPost,
    regenerateInviteLink,
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
