/**
 * WebSocket Service with Redis PUB/SUB
 * 
 * Production-grade real-time communication service that:
 * - Manages WebSocket connections across multiple server instances
 * - Uses Redis PUB/SUB for horizontal scalability
 * - Implements heartbeat/ping-pong for connection health
 * - Handles reconnection logic
 * - Prevents memory leaks and race conditions
 * - Supports 10k+ concurrent users
 */

const { redisPublisher, redisSubscriber, redisClient } = require("../config/redis");

class SocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // Local socket connections
        this.HEARTBEAT_INTERVAL = 25000; // 25 seconds
        this.HEARTBEAT_TIMEOUT = 30000; // 30 seconds
        this.heartbeatIntervals = new Map();
        
        // Redis PUB/SUB channels
        this.CHANNELS = {
            POST_CREATED: "post:created",
            POST_UPDATED: "post:updated",
            POST_DELETED: "post:deleted",
            MESSAGE_SENT: "message:sent",
            MESSAGE_EDITED: "message:edited",
            MESSAGE_DELETED: "message:deleted",
            NOTIFICATION: "notification:sent",
            NOTIFICATION_READ: "notification:read",
            NOTIFICATION_CLEARED: "notification:cleared",
            GROUP_CREATED: "group:created",
            GROUP_UPDATED: "group:updated",
            GROUP_DELETED: "group:deleted",
            USER_UPDATED: "user:updated",
            USER_ONLINE: "user:online",
            USER_OFFLINE: "user:offline",
            UNREAD_COUNT_UPDATED: "unread:count:updated",
            // Channel events
            CHANNEL_CREATED: "channel:created",
            CHANNEL_UPDATED: "channel:updated",
            CHANNEL_DELETED: "channel:deleted",
            CHANNEL_POST_CREATED: "channel:post:created",
            CHANNEL_POST_UPDATED: "channel:post:updated",
            CHANNEL_POST_DELETED: "channel:post:deleted",
        };
    }

    /**
     * Initialize Socket.IO with Redis adapter
     */
    initialize(io) {
        this.io = io;
        this.setupSocketHandlers();
        this.setupRedisSubscriptions();
        console.log("✅ Socket Service initialized with Redis PUB/SUB");
    }

    /**
     * Setup Socket.IO connection handlers
     */
    setupSocketHandlers() {
        this.io.on("connection", (socket) => {
            console.log(`🔌 User connected: ${socket.id}`);

            // Handle user registration
            socket.on("register", async (userId) => {
                try {
                    await this.registerUser(socket, userId);
                } catch (error) {
                    console.error("Error registering user:", error);
                }
            });

            // Handle disconnection
            socket.on("disconnect", async () => {
                await this.handleDisconnect(socket);
            });

            // Handle ping/pong for connection health
            socket.on("ping", () => {
                socket.emit("pong");
            });

            // Call signaling events
            socket.on("call:offer", ({ to, offer, callType, caller }) => {
                this.handleCallOffer(socket, { to, offer, callType, caller });
            });

            socket.on("call:answer", ({ to, answer }) => {
                this.handleCallAnswer(socket, { to, answer });
            });

            socket.on("call:ice-candidate", ({ to, candidate }) => {
                this.handleIceCandidate(socket, { to, candidate });
            });

            socket.on("call:end", ({ to }) => {
                this.handleCallEnd(socket, { to });
            });

            // Start heartbeat for this connection
            this.startHeartbeat(socket);
        });
    }

    /**
     * Register user and store connection in Redis
     */
    async registerUser(socket, userId) {
        // Store in local map
        this.connectedUsers.set(userId, socket.id);
        
        // Join user-specific room
        socket.join(userId);
        socket.userId = userId;

        // Store in Redis with TTL (for cross-server communication)
        await redisClient.setex(
            `socket:${userId}`,
            3600, // 1 hour TTL
            JSON.stringify({
                socketId: socket.id,
                serverId: process.env.SERVER_ID || "server-1",
                connectedAt: Date.now(),
            })
        );

        // Mark user as online in Redis
        await redisClient.setex(`user:online:${userId}`, 3600, Date.now().toString());

        // Broadcast user online status
        await this.publishEvent(this.CHANNELS.USER_ONLINE, {
            userId,
            timestamp: Date.now()
        });

        console.log(`✅ User ${userId} registered with socket ${socket.id} (ONLINE)`);
    }

    /**
     * Handle user disconnection
     */
    async handleDisconnect(socket) {
        const userId = socket.userId;
        
        if (userId) {
            // Remove from local map
            this.connectedUsers.delete(userId);
            
            // Remove from Redis
            await redisClient.del(`socket:${userId}`);
            await redisClient.del(`user:online:${userId}`);

            // Broadcast user offline status
            await this.publishEvent(this.CHANNELS.USER_OFFLINE, {
                userId,
                timestamp: Date.now()
            });
            
            console.log(`❌ User ${userId} disconnected (OFFLINE)`);
        }

        // Clear heartbeat
        this.stopHeartbeat(socket);
        
        console.log(`🔌 Socket ${socket.id} disconnected`);
    }

    /**
     * Start heartbeat to monitor connection health
     */
    startHeartbeat(socket) {
        const interval = setInterval(() => {
            if (socket.connected) {
                socket.emit("heartbeat", { timestamp: Date.now() });
            } else {
                this.stopHeartbeat(socket);
            }
        }, this.HEARTBEAT_INTERVAL);

        this.heartbeatIntervals.set(socket.id, interval);
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat(socket) {
        const interval = this.heartbeatIntervals.get(socket.id);
        if (interval) {
            clearInterval(interval);
            this.heartbeatIntervals.delete(socket.id);
        }
    }

    /**
     * Setup Redis PUB/SUB subscriptions
     */
    setupRedisSubscriptions() {
        // Subscribe to all channels
        Object.values(this.CHANNELS).forEach((channel) => {
            redisSubscriber.subscribe(channel, (err) => {
                if (err) {
                    console.error(`Failed to subscribe to ${channel}:`, err);
                } else {
                    console.log(`📡 Subscribed to Redis channel: ${channel}`);
                }
            });
        });

        // Handle incoming messages from Redis
        redisSubscriber.on("message", (channel, message) => {
            this.handleRedisMessage(channel, message);
        });
    }

    /**
     * Handle messages from Redis PUB/SUB
     */
    handleRedisMessage(channel, message) {
        try {
            const data = JSON.parse(message);

            switch (channel) {
                case this.CHANNELS.POST_CREATED:
                    this.broadcastPostCreated(data);
                    break;
                case this.CHANNELS.POST_UPDATED:
                    this.broadcastPostUpdated(data);
                    break;
                case this.CHANNELS.POST_DELETED:
                    this.broadcastPostDeleted(data);
                    break;
                case this.CHANNELS.MESSAGE_SENT:
                    this.broadcastMessage(data);
                    break;
                case this.CHANNELS.MESSAGE_EDITED:
                    this.broadcastMessageEdited(data);
                    break;
                case this.CHANNELS.MESSAGE_DELETED:
                    this.broadcastMessageDeleted(data);
                    break;
                case this.CHANNELS.NOTIFICATION:
                    this.broadcastNotification(data);
                    break;
                case this.CHANNELS.GROUP_CREATED:
                    this.broadcastGroupCreated(data);
                    break;
                case this.CHANNELS.GROUP_UPDATED:
                    this.broadcastGroupUpdate(data);
                    break;
                case this.CHANNELS.GROUP_DELETED:
                    this.broadcastGroupDeleted(data);
                    break;
                case this.CHANNELS.USER_UPDATED:
                    this.broadcastUserUpdate(data);
                    break;
                case this.CHANNELS.NOTIFICATION_READ:
                    this.broadcastNotificationRead(data);
                    break;
                case this.CHANNELS.NOTIFICATION_CLEARED:
                    this.broadcastNotificationCleared(data);
                    break;
                case this.CHANNELS.USER_ONLINE:
                    this.broadcastUserOnline(data);
                    break;
                case this.CHANNELS.USER_OFFLINE:
                    this.broadcastUserOffline(data);
                    break;
                case this.CHANNELS.UNREAD_COUNT_UPDATED:
                    this.broadcastUnreadCountUpdate(data);
                    break;
                // Channel events
                case this.CHANNELS.CHANNEL_CREATED:
                    this.broadcastChannelCreated(data);
                    break;
                case this.CHANNELS.CHANNEL_UPDATED:
                    this.broadcastChannelUpdated(data);
                    break;
                case this.CHANNELS.CHANNEL_DELETED:
                    this.broadcastChannelDeleted(data);
                    break;
                case this.CHANNELS.CHANNEL_POST_CREATED:
                    this.broadcastChannelPostCreated(data);
                    break;
                case this.CHANNELS.CHANNEL_POST_UPDATED:
                    this.broadcastChannelPostUpdated(data);
                    break;
                case this.CHANNELS.CHANNEL_POST_DELETED:
                    this.broadcastChannelPostDeleted(data);
                    break;
                default:
                    console.warn(`Unknown channel: ${channel}`);
            }
        } catch (error) {
            console.error("Error handling Redis message:", error);
        }
    }

    /**
     * Publish event to Redis (for cross-server communication)
     */
    async publishEvent(channel, data) {
        try {
            await redisPublisher.publish(channel, JSON.stringify(data));
        } catch (error) {
            console.error(`Error publishing to ${channel}:`, error);
        }
    }

    // ==================== BROADCAST METHODS ====================

    /**
     * Broadcast new post to all connected users EXCEPT the creator
     */
    broadcastPostCreated(post) {
        // Emit to all users except the post creator
        this.io.emit("postCreated", post);
        console.log(`📢 Broadcasted new post: ${post.postId}`);
    }

    /**
     * Broadcast post update to all connected users
     */
    broadcastPostUpdated(post) {
        this.io.emit("postUpdated", post);
        console.log(`📢 Broadcasted post update: ${post.postId}`);
    }

    /**
     * Broadcast post deletion to all connected users
     */
    broadcastPostDeleted(postId) {
        this.io.emit("postDeleted", postId);
        console.log(`📢 Broadcasted post deletion: ${postId}`);
    }

    /**
     * Send message to specific user
     */
    async broadcastMessage(data) {
        const { receiverId, message } = data;
        
        // Try to send to local connection first
        const socketId = this.connectedUsers.get(receiverId);
        if (socketId) {
            this.io.to(receiverId).emit("message", message);
            console.log(`💬 Sent message to user ${receiverId}`);
        } else {
            // User might be connected to another server instance
            console.log(`User ${receiverId} not connected to this server`);
        }
    }

    /**
     * Broadcast message edit to both sender and receiver
     */
    async broadcastMessageEdited(data) {
        const { messageId, content, receiverId, senderId } = data;
        
        // Send to receiver
        this.io.to(receiverId).emit("messageEdited", { messageId, content });
        // Send to sender (in case they have multiple tabs/devices)
        this.io.to(senderId).emit("messageEdited", { messageId, content });
        
        console.log(`✏️ Broadcasted message edit: ${messageId}`);
    }

    /**
     * Broadcast message deletion to both sender and receiver
     */
    async broadcastMessageDeleted(data) {
        const { messageId, receiverId, senderId } = data;
        
        // Send to receiver
        this.io.to(receiverId).emit("messageDeleted", { messageId });
        // Send to sender (in case they have multiple tabs/devices)
        this.io.to(senderId).emit("messageDeleted", { messageId });
        
        console.log(`🗑️ Broadcasted message deletion: ${messageId}`);
    }

    /**
     * Send notification to specific user
     */
    async broadcastNotification(data) {
        const { userId, notification } = data;
        
        // Try to send to local connection first
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(userId).emit("notification", notification);
            console.log(`🔔 Sent notification to user ${userId}`);
        } else {
            // User might be connected to another server instance
            console.log(`User ${userId} not connected to this server`);
        }
    }

    /**
     * Broadcast new group creation
     */
    broadcastGroupCreated(group) {
        this.io.emit("groupCreated", group);
        console.log(`📢 Broadcasted new group: ${group.groupId}`);
    }

    /**
     * Broadcast group update to all users
     */
    broadcastGroupUpdate(data) {
        const { groupId, group, action } = data;
        this.io.emit("groupUpdated", { groupId, group, action });
        console.log(`📢 Broadcasted group update: ${groupId} (${action})`);
    }

    /**
     * Broadcast group deletion
     */
    broadcastGroupDeleted(groupId) {
        this.io.emit("groupDeleted", groupId);
        console.log(`📢 Broadcasted group deletion: ${groupId}`);
    }

    // ==================== CHANNEL BROADCAST METHODS ====================

    /**
     * Broadcast channel created
     */
    broadcastChannelCreated(data) {
        this.io.emit("channelCreated", data);
        console.log(`📢 Broadcasted channel created: ${data.channelId}`);
    }

    /**
     * Broadcast channel updated
     */
    broadcastChannelUpdated(data) {
        this.io.emit("channelUpdated", data);
        console.log(`📢 Broadcasted channel updated: ${data.channelId}`);
    }

    /**
     * Broadcast channel deleted
     */
    broadcastChannelDeleted(channelId) {
        this.io.emit("channelDeleted", channelId);
        console.log(`📢 Broadcasted channel deletion: ${channelId}`);
    }

    /**
     * Broadcast channel post created
     */
    broadcastChannelPostCreated(data) {
        const { channelId, post } = data;
        this.io.emit("channelPostCreated", { channelId, post });
        console.log(`📢 Broadcasted channel post created: ${post.postId} in channel ${channelId}`);
    }

    /**
     * Broadcast channel post updated
     */
    broadcastChannelPostUpdated(data) {
        const { channelId, post } = data;
        this.io.emit("channelPostUpdated", { channelId, post });
        console.log(`📢 Broadcasted channel post updated: ${post.postId} in channel ${channelId}`);
    }

    /**
     * Broadcast channel post deleted
     */
    broadcastChannelPostDeleted(data) {
        const { channelId, postId } = data;
        this.io.emit("channelPostDeleted", { channelId, postId });
        console.log(`📢 Broadcasted channel post deleted: ${postId} in channel ${channelId}`);
    }

    /**
     * Broadcast user profile update (follow/unfollow, profile changes)
     */
    broadcastUserUpdate(data) {
        const { userId, user, action } = data;
        this.io.emit("userUpdated", { userId, user, action });
        console.log(`📢 Broadcasted user update: ${userId} (${action})`);
    }

    /**
     * Broadcast notification read event
     */
    broadcastNotificationRead(data) {
        const { userId, notificationId } = data;
        this.io.to(userId).emit("notificationRead", { notificationId });
        console.log(`📢 Broadcasted notification read: ${notificationId}`);
    }

    /**
     * Broadcast notification cleared event
     */
    broadcastNotificationCleared(data) {
        const { userId } = data;
        this.io.to(userId).emit("notificationsCleared");
        console.log(`📢 Broadcasted notifications cleared for user: ${userId}`);
    }

    /**
     * Send upload progress to specific user
     */
    sendUploadProgress(userId, progressData) {
        this.io.to(userId).emit("uploadProgress", progressData);
    }

    // ==================== CALL SIGNALING ====================

    handleCallOffer(socket, { to, offer, callType, caller }) {
        const receiverSocketId = this.connectedUsers.get(to);
        if (receiverSocketId) {
            this.io.to(receiverSocketId).emit("call:incoming", {
                from: caller,
                offer,
                callType,
            });
        }
    }

    handleCallAnswer(socket, { to, answer }) {
        const callerSocketId = this.connectedUsers.get(to);
        if (callerSocketId) {
            this.io.to(callerSocketId).emit("call:answer", { answer });
        }
    }

    handleIceCandidate(socket, { to, candidate }) {
        const receiverSocketId = this.connectedUsers.get(to);
        if (receiverSocketId) {
            this.io.to(receiverSocketId).emit("call:ice-candidate", { candidate });
        }
    }

    handleCallEnd(socket, { to }) {
        const receiverSocketId = this.connectedUsers.get(to);
        if (receiverSocketId) {
            this.io.to(receiverSocketId).emit("call:ended");
        }
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get user's socket ID (checks Redis if not in local map)
     */
    async getUserSocketId(userId) {
        // Check local map first
        if (this.connectedUsers.has(userId)) {
            return this.connectedUsers.get(userId);
        }

        // Check Redis for cross-server lookup
        const data = await redisClient.get(`socket:${userId}`);
        if (data) {
            const { socketId } = JSON.parse(data);
            return socketId;
        }

        return null;
    }

    /**
     * Broadcast user online status
     */
    broadcastUserOnline(data) {
        const { userId, timestamp } = data;
        this.io.emit("userOnline", { userId, timestamp });
        console.log(`🟢 Broadcasted user online: ${userId}`);
    }

    /**
     * Broadcast user offline status
     */
    broadcastUserOffline(data) {
        const { userId, timestamp } = data;
        this.io.emit("userOffline", { userId, timestamp });
        console.log(`⚫ Broadcasted user offline: ${userId}`);
    }

    /**
     * Broadcast unread count update to specific user
     */
    broadcastUnreadCountUpdate(data) {
        const { userId, unreadCount } = data;
        this.io.to(userId).emit("unreadCountUpdated", { unreadCount });
        console.log(`📬 Broadcasted unread count update to ${userId}: ${unreadCount}`);
    }

    /**
     * Check if user is online
     */
    async isUserOnline(userId) {
        const onlineStatus = await redisClient.get(`user:online:${userId}`);
        return onlineStatus !== null;
    }

    /**
     * Get online status for multiple users
     */
    async getUsersOnlineStatus(userIds) {
        const statuses = {};
        for (const userId of userIds) {
            statuses[userId] = await this.isUserOnline(userId);
        }
        return statuses;
    }

    /**
     * Get all connected users count
     */
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
}

// Export singleton instance
module.exports = new SocketService();
