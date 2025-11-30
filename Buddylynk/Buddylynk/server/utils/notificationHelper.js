const Notification = require("../models/Notification");

const sendNotification = async (io, connectedUsers, userId, message, type, relatedId) => {
    try {
        // Create notification in database
        const notification = await Notification.createNotification({
            userId,
            message,
            type,
            relatedId,
        });

        // Send real-time notification if user is connected
        const socketId = connectedUsers.get(userId);
        if (socketId) {
            io.to(socketId).emit("notification", notification);
        }

        return notification;
    } catch (error) {
        console.error("Error sending notification:", error);
    }
};

module.exports = { sendNotification };
