import { createContext, useState, useEffect, useContext } from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import axios from "axios";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const { socket, on, off } = useSocket();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [incomingCall, setIncomingCall] = useState(null);

    useEffect(() => {
        if (user) {
            // Request browser notification permission
            if (Notification.permission === "default") {
                Notification.requestPermission();
            }

            // Fetch existing notifications
            fetchNotifications();
        }
    }, [user]);

    useEffect(() => {
        if (!socket) return;

        // Listen for new notifications
        const handleNotification = (notification) => {
            console.log("📬 New notification received:", notification);
            setNotifications(prev => {
                // Avoid duplicates
                const exists = prev.some(n => n.notificationId === notification.notificationId);
                if (exists) return prev;
                return [notification, ...prev];
            });
            setUnreadCount(prev => prev + 1);
            
            // Show browser notification if permission granted
            if (Notification.permission === "granted") {
                new Notification("Buddylynk", {
                    body: `${notification.fromUsername} ${notification.type === 'like' ? 'liked your post' : notification.type === 'comment' ? 'commented on your post' : 'sent you a message'}`,
                    icon: notification.fromUserAvatar || '/favicon.ico'
                });
            }
        };

        // Listen for notification read events
        const handleNotificationRead = ({ notificationId }) => {
            console.log("✅ Notification marked as read:", notificationId);
            setNotifications(prev => 
                prev.map(n => n.notificationId === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        };

        // Listen for notifications cleared event
        const handleNotificationsCleared = () => {
            console.log("🧹 All notifications cleared");
            setNotifications([]);
            setUnreadCount(0);
        };

        // Listen for incoming calls globally
        const handleIncomingCall = ({ from, offer, callType }) => {
            console.log("📞 Global incoming call from:", from);
            setIncomingCall({ from, offer, callType });
            
            // Show browser notification for incoming call
            if (Notification.permission === "granted") {
                new Notification("Incoming Call", {
                    body: `${from.username} is calling you...`,
                    icon: from.avatar || '/favicon.ico',
                    requireInteraction: true
                });
            }
        };

        // Listen for call ended
        const handleCallEnded = () => {
            setIncomingCall(null);
        };

        on("notification", handleNotification);
        on("notificationRead", handleNotificationRead);
        on("notificationsCleared", handleNotificationsCleared);
        on("call:incoming", handleIncomingCall);
        on("call:ended", handleCallEnded);

        // Cleanup listeners on unmount
        return () => {
            off("notification", handleNotification);
            off("notificationRead", handleNotificationRead);
            off("notificationsCleared", handleNotificationsCleared);
            off("call:incoming", handleIncomingCall);
            off("call:ended", handleCallEnded);
        };
    }, [socket, on, off]);

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("/api/notifications", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(res.data);
            setUnreadCount(res.data.filter(n => !n.read).length);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.put(`/api/notifications/${notificationId}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(prev => 
                prev.map(n => n.notificationId === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const clearAll = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete("/api/notifications/clear-all", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error("Error clearing notifications:", error);
        }
    };

    const markMessageNotificationsAsRead = async (fromUserId) => {
        try {
            // Find all unread message notifications from this user
            const messageNotifications = notifications.filter(
                n => !n.read && n.type === 'message' && n.fromUserId === fromUserId
            );

            if (messageNotifications.length === 0) return;

            const token = localStorage.getItem("token");
            
            // Mark each notification as read
            await Promise.all(
                messageNotifications.map(n => 
                    axios.put(`/api/notifications/${n.notificationId}/read`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                )
            );

            // Update local state
            setNotifications(prev => 
                prev.map(n => 
                    messageNotifications.some(mn => mn.notificationId === n.notificationId)
                        ? { ...n, read: true }
                        : n
                )
            );
            setUnreadCount(prev => Math.max(0, prev - messageNotifications.length));
            
            console.log(`✅ Marked ${messageNotifications.length} message notifications as read`);
        } catch (error) {
            console.error("Error marking message notifications as read:", error);
        }
    };

    const dismissIncomingCall = () => {
        setIncomingCall(null);
    };

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            markAsRead, 
            clearAll, 
            markMessageNotificationsAsRead,
            socket,
            incomingCall,
            dismissIncomingCall
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
