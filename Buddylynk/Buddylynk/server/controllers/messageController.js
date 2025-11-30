const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { redisClient } = require("../config/redis");

const getConversations = async (req, res) => {
    try {
        const conversations = await Message.getUserConversations(req.user.userId);
        
        // Fetch user details for each conversation
        const conversationsWithUsers = await Promise.all(
            conversations.map(async (conv) => {
                const user = await User.getUserById(conv.partnerId);
                return {
                    ...conv,
                    user: {
                        userId: user.userId,
                        username: user.username,
                        avatar: user.avatar,
                    },
                };
            })
        );

        res.json(conversationsWithUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        const messages = await Message.getConversation(req.user.userId, userId);
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { userId } = req.params; // The other user's ID
        const currentUserId = req.user.userId;
        
        console.log(`📖 Mark as read request: currentUser=${currentUserId}, otherUser=${userId}`);
        
        // Get unread count before marking as read
        const messages = await Message.getConversation(currentUserId, userId);
        const unreadCount = messages.filter(msg => 
            msg.receiverId === currentUserId && 
            msg.senderId === userId && 
            !msg.read
        ).length;
        
        console.log(`📊 Found ${unreadCount} unread messages to mark as read`);
        
        if (unreadCount === 0) {
            console.log(`ℹ️  No unread messages to mark as read`);
            return res.json({ message: "No unread messages", unreadCount: 0 });
        }
        
        // Mark messages as read in database
        await Message.markMessagesAsRead(currentUserId, userId);
        console.log(`✅ Marked messages as read in database`);
        
        // Update Redis unread count
        const redisKey = `unread:${currentUserId}`;
        const currentCount = parseInt(await redisClient.get(redisKey) || '0');
        const newCount = Math.max(0, currentCount - unreadCount);
        
        console.log(`📉 Redis update: ${currentCount} → ${newCount} (decreased by ${unreadCount})`);
        
        if (newCount > 0) {
            await redisClient.setex(redisKey, 86400, newCount.toString()); // 24 hour TTL
            console.log(`💾 Updated Redis key ${redisKey} = ${newCount}`);
        } else {
            await redisClient.del(redisKey);
            console.log(`🗑️  Deleted Redis key ${redisKey} (count is 0)`);
        }
        
        // Broadcast unread count update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.UNREAD_COUNT_UPDATED, {
            userId: currentUserId,
            unreadCount: newCount
        });
        
        console.log(`📡 Broadcasted unread count update: ${newCount}`);
        
        res.json({ message: "Messages marked as read", unreadCount: newCount });
    } catch (error) {
        console.error('❌ Error in markAsRead:', error);
        res.status(500).json({ message: "Server error" });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { receiverId, content, mediaUrl, mediaType } = req.body;
        const sender = await User.getUserById(req.user.userId);

        const messageData = {
            senderId: req.user.userId,
            senderName: sender.username,
            senderAvatar: sender.avatar,
            receiverId,
            content: content || '',
            read: false,
        };

        // Add media fields if present
        if (mediaUrl) {
            messageData.mediaUrl = mediaUrl;
            messageData.mediaType = mediaType || 'image';
        }

        const message = await Message.createMessage(messageData);

        // Increment unread count in Redis for receiver
        const redisKey = `unread:${receiverId}`;
        const currentCount = parseInt(await redisClient.get(redisKey) || '0');
        const newCount = currentCount + 1;
        await redisClient.setex(redisKey, 86400, newCount.toString()); // 24 hour TTL
        
        console.log(`📬 New message for user ${receiverId}. Unread count: ${newCount}`);

        // Create notification for new message
        const notificationMessage = mediaUrl 
            ? `📷 Sent ${mediaType === 'video' ? 'a video' : 'an image'}`
            : content.substring(0, 50) + (content.length > 50 ? "..." : "");
            
        const notification = await Notification.createNotification({
            userId: receiverId,
            type: "message",
            fromUserId: req.user.userId,
            fromUsername: sender.username,
            fromUserAvatar: sender.avatar,
            message: notificationMessage,
        });

        // Broadcast via Redis PUB/SUB for scalability
        const socketService = req.app.get("socketService");
        
        // Send message to receiver
        await socketService.publishEvent(socketService.CHANNELS.MESSAGE_SENT, {
            receiverId,
            message
        });
        
        // Send notification to receiver
        await socketService.publishEvent(socketService.CHANNELS.NOTIFICATION, {
            userId: receiverId,
            notification
        });
        
        // Broadcast unread count update
        await socketService.publishEvent(socketService.CHANNELS.UNREAD_COUNT_UPDATED, {
            userId: receiverId,
            unreadCount: newCount
        });

        res.status(201).json(message);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId;
        const redisKey = `unread:${userId}`;
        let unreadCount = parseInt(await redisClient.get(redisKey) || '0');
        
        // If Redis count is 0 or doesn't exist, recalculate from database
        if (unreadCount === 0) {
            const conversations = await Message.getUserConversations(userId);
            const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
            
            if (totalUnread > 0) {
                // Update Redis with correct count
                await redisClient.setex(redisKey, 86400, totalUnread.toString());
                unreadCount = totalUnread;
                console.log(`🔄 Synced Redis count for user ${userId}: ${totalUnread}`);
            }
        }
        
        res.json({ unreadCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const syncUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Recalculate from database
        const conversations = await Message.getUserConversations(userId);
        const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
        
        // Update Redis
        const redisKey = `unread:${userId}`;
        if (totalUnread > 0) {
            await redisClient.setex(redisKey, 86400, totalUnread.toString());
        } else {
            await redisClient.del(redisKey);
        }
        
        console.log(`🔄 Synced unread count for user ${userId}: ${totalUnread}`);
        
        // Broadcast update
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.UNREAD_COUNT_UPDATED, {
            userId,
            unreadCount: totalUnread
        });
        
        res.json({ unreadCount: totalUnread, synced: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;

        // Get the message first to verify ownership
        const message = await Message.getMessageById(messageId);
        
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }
        
        // Only the sender can edit their message
        if (message.senderId !== userId) {
            return res.status(403).json({ message: "You can only edit your own messages" });
        }

        const updatedMessage = await Message.updateMessage(messageId, content);
        
        if (!updatedMessage) {
            return res.status(500).json({ message: "Failed to update message" });
        }

        // Broadcast the edit via Socket.IO
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.MESSAGE_EDITED, {
            messageId,
            content,
            receiverId: message.receiverId,
            senderId: message.senderId
        });

        res.json(updatedMessage);
    } catch (error) {
        console.error("Error editing message:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const deleteMessageHandler = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.userId;

        // Get the message first to verify ownership
        const message = await Message.getMessageById(messageId);
        
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }
        
        // Only the sender can delete their message
        if (message.senderId !== userId) {
            return res.status(403).json({ message: "You can only delete your own messages" });
        }

        const deleted = await Message.deleteMessage(messageId);
        
        if (!deleted) {
            return res.status(500).json({ message: "Failed to delete message" });
        }

        // Broadcast the deletion via Socket.IO
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.MESSAGE_DELETED, {
            messageId,
            receiverId: message.receiverId,
            senderId: message.senderId
        });

        res.json({ message: "Message deleted successfully" });
    } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { getConversations, getMessages, sendMessage, markAsRead, getUnreadCount, syncUnreadCount, editMessage, deleteMessage: deleteMessageHandler };
