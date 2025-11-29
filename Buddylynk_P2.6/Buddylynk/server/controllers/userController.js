const { GetCommand, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { uploadToS3, deleteFromS3 } = require("../middleware/uploadMiddleware");

const getUserProfile = async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch user and posts in parallel for better performance
        const [userRes, postsRes] = await Promise.all([
            docClient.send(new GetCommand({
                TableName: "Buddylynk_Users",
                Key: { userId: id },
            })),
            docClient.send(new ScanCommand({
                TableName: "Buddylynk_Posts",
                FilterExpression: "userId = :userId",
                ExpressionAttributeValues: { ":userId": id },
            }))
        ]);

        if (!userRes.Item) return res.status(404).json({ message: "User not found" });

        // Sort posts by date (newest first) and limit to recent posts for faster loading
        const sortedPosts = (postsRes.Items || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 20); // Limit to 20 most recent posts

        res.json({ user: userRes.Item, posts: sortedPosts });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const updateProfile = async (req, res) => {
    const { bio, username } = req.body;
    const userId = req.user.userId;

    console.log(`\n👤 Profile Update Request for user: ${userId}`);

    try {
        // First get existing user to preserve other fields
        const getCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId },
        });
        const userRes = await docClient.send(getCmd);
        const currentUser = userRes.Item;

        // Check if username is being changed and if it's unique
        let finalUsername = currentUser.username;
        if (username && username !== currentUser.username) {
            // Check if username is already taken
            const existingUser = await docClient.send(new ScanCommand({
                TableName: "Buddylynk_Users",
                FilterExpression: "username = :username AND userId <> :userId",
                ExpressionAttributeValues: {
                    ":username": username,
                    ":userId": userId
                },
            }));

            if (existingUser.Items && existingUser.Items.length > 0) {
                return res.status(400).json({ 
                    message: "Username already taken. Please choose a different username." 
                });
            }
            
            finalUsername = username;
        }

        let avatarUrl = currentUser.avatar;
        let bannerUrl = currentUser.banner;

        // Handle avatar upload
        if (req.files && req.files.avatar) {
            console.log('🖼️  New avatar file detected, uploading to S3...');

            // 🗑️  Delete old avatar from S3 if it exists
            if (currentUser.avatar) {
                await deleteFromS3(currentUser.avatar);
            }

            avatarUrl = await uploadToS3(req.files.avatar[0]);
            console.log(`✅ Avatar URL saved: ${avatarUrl}`);
        }

        // Handle banner upload
        if (req.files && req.files.banner) {
            console.log('🎨 New banner file detected, uploading to S3...');

            // 🗑️  Delete old banner from S3 if it exists
            if (currentUser.banner) {
                await deleteFromS3(currentUser.banner);
            }

            bannerUrl = await uploadToS3(req.files.banner[0]);
            console.log(`✅ Banner URL saved: ${bannerUrl}`);
        }

        const updatedUser = {
            ...currentUser,
            bio: bio || currentUser.bio,
            username: finalUsername,
            avatar: avatarUrl,
            banner: bannerUrl,
        };

        console.log('💾 Saving updated user to DynamoDB...');
        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedUser,
        }));

        console.log('✅ Profile updated successfully');
        console.log(`   Avatar: ${avatarUrl}`);
        console.log(`   Banner: ${bannerUrl}\n`);

        // Broadcast profile update via Redis PUB/SUB
        // This updates avatar/banner on all posts and comments
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.USER_UPDATED, {
            userId,
            user: updatedUser,
            action: 'profileUpdate'
        });
        
        console.log(`📡 Broadcasted profile update for user: ${userId}`);

        res.json(updatedUser);
    } catch (error) {
        console.error('❌ Profile update failed:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const blockUser = async (req, res) => {
    const { targetUserId } = req.body;
    const userId = req.user.userId;

    try {
        const getCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId },
        });
        const userRes = await docClient.send(getCmd);
        const currentUser = userRes.Item;

        const blockedUsers = currentUser.blockedUsers || [];

        if (!blockedUsers.includes(targetUserId)) {
            blockedUsers.push(targetUserId);
        }

        const updatedUser = {
            ...currentUser,
            blockedUsers,
        };

        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedUser,
        }));

        // Broadcast block event via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.USER_UPDATED, {
            userId,
            user: updatedUser,
            action: 'block',
            blockedUserId: targetUserId
        });

        console.log(`✅ User ${userId} blocked ${targetUserId}`);

        res.json({ message: "User blocked successfully", blockedUsers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const unblockUser = async (req, res) => {
    const { targetUserId } = req.body;
    const userId = req.user.userId;

    try {
        const getCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId },
        });
        const userRes = await docClient.send(getCmd);
        const currentUser = userRes.Item;

        const blockedUsers = (currentUser.blockedUsers || []).filter(id => id !== targetUserId);

        const updatedUser = {
            ...currentUser,
            blockedUsers,
        };

        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedUser,
        }));

        // Broadcast unblock event via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.USER_UPDATED, {
            userId,
            user: updatedUser,
            action: 'unblock',
            unblockedUserId: targetUserId
        });

        console.log(`✅ User ${userId} unblocked ${targetUserId}`);

        res.json({ message: "User unblocked successfully", blockedUsers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getBlockedUsers = async (req, res) => {
    const userId = req.user.userId;

    try {
        const getCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId },
        });
        const userRes = await docClient.send(getCmd);
        const currentUser = userRes.Item;

        const blockedUserIds = currentUser.blockedUsers || [];

        // Get details of blocked users
        const blockedUsersDetails = await Promise.all(
            blockedUserIds.map(async (blockedId) => {
                const cmd = new GetCommand({
                    TableName: "Buddylynk_Users",
                    Key: { userId: blockedId },
                });
                const result = await docClient.send(cmd);
                return result.Item;
            })
        );

        res.json({ blockedUsers: blockedUsersDetails.filter(u => u) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const updateSettings = async (req, res) => {
    const userId = req.user.userId;

    try {
        const getCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId },
        });
        const userRes = await docClient.send(getCmd);
        const currentUser = userRes.Item;

        const updatedUser = {
            ...currentUser,
            settings: {
                ...(currentUser.settings || {}),
                ...req.body, // Merge new settings
            },
        };

        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedUser,
        }));

        // Broadcast settings update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.USER_UPDATED, {
            userId,
            user: updatedUser,
            action: 'settingsUpdate'
        });

        console.log(`✅ Settings updated for user ${userId}`);

        res.json(updatedUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const followUser = async (req, res) => {
    const { targetUserId } = req.body;
    const userId = req.user.userId;

    if (userId === targetUserId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
    }

    try {
        const getCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId },
        });
        const userRes = await docClient.send(getCmd);
        const currentUser = userRes.Item;

        const following = currentUser.following || [];

        if (!following.includes(targetUserId)) {
            following.push(targetUserId);
        }

        const updatedUser = {
            ...currentUser,
            following,
        };

        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedUser,
        }));

        // Update target user's followers
        const targetCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId: targetUserId },
        });
        const targetRes = await docClient.send(targetCmd);
        const targetUser = targetRes.Item;

        const followers = targetUser.followers || [];
        if (!followers.includes(userId)) {
            followers.push(userId);
        }

        const updatedTargetUser = { ...targetUser, followers };

        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedTargetUser,
        }));

        // Broadcast follow event via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.USER_UPDATED, {
            userId: targetUserId,
            user: updatedTargetUser,
            action: 'follow',
            followerId: userId
        });

        console.log(`✅ User ${userId} followed ${targetUserId}`);

        res.json({ message: "User followed successfully", following });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const unfollowUser = async (req, res) => {
    const { targetUserId } = req.body;
    const userId = req.user.userId;

    try {
        const getCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId },
        });
        const userRes = await docClient.send(getCmd);
        const currentUser = userRes.Item;

        const following = (currentUser.following || []).filter(id => id !== targetUserId);

        const updatedUser = {
            ...currentUser,
            following,
        };

        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedUser,
        }));

        // Update target user's followers
        const targetCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId: targetUserId },
        });
        const targetRes = await docClient.send(targetCmd);
        const targetUser = targetRes.Item;

        const followers = (targetUser.followers || []).filter(id => id !== userId);

        const updatedTargetUser = { ...targetUser, followers };

        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedTargetUser,
        }));

        // Broadcast unfollow event via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.USER_UPDATED, {
            userId: targetUserId,
            user: updatedTargetUser,
            action: 'unfollow',
            unfollowerId: userId
        });

        console.log(`✅ User ${userId} unfollowed ${targetUserId}`);

        res.json({ message: "User unfollowed successfully", following });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    try {
        const bcrypt = require("bcryptjs");

        // Get user
        const getCmd = new GetCommand({
            TableName: "Buddylynk_Users",
            Key: { userId },
        });
        const userRes = await docClient.send(getCmd);
        const currentUser = userRes.Item;

        if (!currentUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, currentUser.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        const updatedUser = {
            ...currentUser,
            password: hashedPassword,
        };

        await docClient.send(new PutCommand({
            TableName: "Buddylynk_Users",
            Item: updatedUser,
        }));

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const command = new ScanCommand({
            TableName: "Buddylynk_Users",
        });
        const response = await docClient.send(command);

        // Return users sorted by creation date (newest first)
        const users = response.Items.sort((a, b) =>
            new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );

        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getUserSuggestions = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json([]);
        }

        const command = new ScanCommand({
            TableName: "Buddylynk_Users",
        });
        const response = await docClient.send(command);

        // Filter users by username or email matching the query
        const query = q.toLowerCase();
        const suggestions = response.Items
            .filter(user =>
                user.username.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query)
            )
            .slice(0, 5) // Limit to 5 suggestions
            .map(user => ({
                userId: user.userId,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }));

        res.json(suggestions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getBatchUsers = async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.json({});
        }

        // Fetch all users in parallel
        const userPromises = userIds.map(async (userId) => {
            try {
                const cmd = new GetCommand({
                    TableName: "Buddylynk_Users",
                    Key: { userId },
                });
                const result = await docClient.send(cmd);
                return result.Item;
            } catch (error) {
                console.error(`Error fetching user ${userId}:`, error);
                return null;
            }
        });

        const users = await Promise.all(userPromises);

        // Get online status for all users
        const socketService = req.app.get("socketService");
        const onlineStatuses = await socketService.getUsersOnlineStatus(userIds);

        // Return as object with userId as key for easy lookup
        const userMap = {};
        users.forEach(user => {
            if (user) {
                userMap[user.userId] = {
                    userId: user.userId,
                    username: user.username,
                    avatar: user.avatar,
                    isOnline: onlineStatuses[user.userId] || false
                };
            }
        });

        res.json(userMap);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const checkOnlineStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const socketService = req.app.get("socketService");
        const isOnline = await socketService.isUserOnline(userId);
        
        res.json({ userId, isOnline });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const checkMultipleOnlineStatus = async (req, res) => {
    try {
        const { userIds } = req.body;
        
        if (!userIds || !Array.isArray(userIds)) {
            return res.status(400).json({ message: "userIds array required" });
        }

        const socketService = req.app.get("socketService");
        const statuses = await socketService.getUsersOnlineStatus(userIds);
        
        res.json(statuses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getUserProfile,
    updateProfile,
    blockUser,
    unblockUser,
    getBlockedUsers,
    updateSettings,
    followUser,
    unfollowUser,
    changePassword,
    getAllUsers,
    getUserSuggestions,
    getBatchUsers,
    checkOnlineStatus,
    checkMultipleOnlineStatus
};
