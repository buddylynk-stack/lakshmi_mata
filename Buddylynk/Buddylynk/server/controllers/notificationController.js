const Notification = require("../models/Notification");

const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.getUserNotifications(req.user.userId);
        res.json(notifications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const markNotificationAsRead = async (req, res) => {
    try {
        await Notification.markAsRead(req.params.id);
        
        // Broadcast notification read event via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.NOTIFICATION_READ, {
            userId: req.user.userId,
            notificationId: req.params.id
        });
        
        res.json({ message: "Notification marked as read" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const clearAllNotifications = async (req, res) => {
    try {
        await Notification.clearAllNotifications(req.user.userId);
        
        // Broadcast clear all event via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.NOTIFICATION_CLEARED, {
            userId: req.user.userId
        });
        
        res.json({ message: "All notifications cleared" });
    } catch (error) {
        console.error("Error clearing notifications:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { getNotifications, markNotificationAsRead, clearAllNotifications };
