/**
 * Custom Hook for Real-Time User Updates
 * 
 * Manages WebSocket listeners for user-related events:
 * - Follow/Unfollow updates
 * - Profile updates
 * - User status changes
 * 
 * Prevents duplicate listeners and memory leaks
 */

import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";

export const useRealTimeUser = (userId, setUser) => {
    const { socket, on, off } = useSocket();

    useEffect(() => {
        if (!socket || !userId) return;

        // Handler for user updates
        const handleUserUpdated = (data) => {
            // Only update if it's the user we're watching
            if (data.userId === userId) {
                console.log("👤 User updated:", data.userId, "Action:", data.action);
                setUser(prevUser => {
                    if (!prevUser) return data.user;
                    
                    // Merge all fields from data.user, preserving arrays if not provided
                    return {
                        ...prevUser,
                        ...data.user,
                        // Preserve arrays if not in update
                        followers: data.user.followers !== undefined ? data.user.followers : prevUser.followers,
                        following: data.user.following !== undefined ? data.user.following : prevUser.following,
                        blockedUsers: data.user.blockedUsers !== undefined ? data.user.blockedUsers : prevUser.blockedUsers,
                        // Ensure profile fields are updated
                        avatar: data.user.avatar !== undefined ? data.user.avatar : prevUser.avatar,
                        banner: data.user.banner !== undefined ? data.user.banner : prevUser.banner,
                        bio: data.user.bio !== undefined ? data.user.bio : prevUser.bio,
                        username: data.user.username !== undefined ? data.user.username : prevUser.username,
                    };
                });
            }
        };

        // Subscribe to events
        on("userUpdated", handleUserUpdated);

        console.log("✅ Real-time user listeners registered for:", userId);

        // Cleanup listeners on unmount
        return () => {
            off("userUpdated", handleUserUpdated);
            console.log("🧹 Real-time user listeners cleaned up");
        };
    }, [socket, on, off, userId, setUser]);
};
