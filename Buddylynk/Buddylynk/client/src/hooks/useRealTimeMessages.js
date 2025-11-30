/**
 * Custom Hook for Real-Time Message Updates
 * 
 * Manages WebSocket listeners for message-related events:
 * - New messages received
 * - Message read status updates
 * 
 * Prevents duplicate listeners and memory leaks
 */

import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";

export const useRealTimeMessages = (selectedUser, setMessages, fetchConversations, markAsRead, userId) => {
    const { socket, on, off } = useSocket();

    useEffect(() => {
        if (!socket) return;

        // Handler for new messages
        const handleMessage = (message) => {
            console.log("💬 New message received:", message);
            
            // Add message to current conversation if it's relevant
            if (selectedUser && (message.senderId === selectedUser.userId || message.receiverId === selectedUser.userId)) {
                setMessages(prev => {
                    // Avoid duplicates
                    const exists = prev.some(m => m.messageId === message.messageId);
                    if (exists) return prev;
                    return [...prev, message];
                });
                
                // Mark as read if chat is open and message is from the selected user
                if (message.senderId === selectedUser.userId) {
                    markAsRead(selectedUser.userId);
                }
            }
            
            // Update conversations list
            fetchConversations();
        };

        // Handler for message read status
        const handleMessagesRead = (data) => {
            console.log("👁️ Messages marked as read:", data);
            // Update messages with read status
            setMessages(prev => 
                prev.map(msg => 
                    msg.senderId === userId && msg.receiverId === data.userId 
                        ? { ...msg, read: true } 
                        : msg
                )
            );
            fetchConversations();
        };

        // Subscribe to events
        on("message", handleMessage);
        on("messagesRead", handleMessagesRead);

        console.log("✅ Real-time message listeners registered");

        // Cleanup listeners on unmount
        return () => {
            off("message", handleMessage);
            off("messagesRead", handleMessagesRead);
            console.log("🧹 Real-time message listeners cleaned up");
        };
    }, [socket, on, off, selectedUser, setMessages, fetchConversations, markAsRead, userId]);
};
