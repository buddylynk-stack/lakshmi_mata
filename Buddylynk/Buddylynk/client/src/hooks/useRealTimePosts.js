/**
 * Custom Hook for Real-Time Post Updates
 * 
 * Manages WebSocket listeners for post-related events:
 * - New posts created
 * - Post updates (likes, comments, shares, etc.)
 * - Post deletions
 * 
 * Prevents duplicate listeners and memory leaks
 */

import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";

export const useRealTimePosts = (setPosts) => {
    const { socket, on, off } = useSocket();

    useEffect(() => {
        if (!socket) return;

        // Handler for new posts
        const handlePostCreated = (newPost) => {
            console.log("📢 New post received:", newPost.postId);
            setPosts(prevPosts => {
                // Prevent duplicates
                const exists = prevPosts.some(post => post.postId === newPost.postId);
                if (exists) {
                    console.log("Post already exists, skipping:", newPost.postId);
                    return prevPosts;
                }
                return [newPost, ...prevPosts];
            });
        };

        // Handler for post updates
        const handlePostUpdated = (updatedPost) => {
            console.log("🔄 Post updated:", updatedPost.postId);
            setPosts(prevPosts =>
                prevPosts.map(post =>
                    post.postId === updatedPost.postId ? updatedPost : post
                )
            );
        };

        // Handler for post deletions
        const handlePostDeleted = (deletedPostId) => {
            console.log("🗑️ Post deleted:", deletedPostId);
            setPosts(prevPosts =>
                prevPosts.filter(post => post.postId !== deletedPostId)
            );
        };

        // Subscribe to events
        on("postCreated", handlePostCreated);
        on("postUpdated", handlePostUpdated);
        on("postDeleted", handlePostDeleted);

        console.log("✅ Real-time post listeners registered");

        // Cleanup listeners on unmount
        return () => {
            off("postCreated", handlePostCreated);
            off("postUpdated", handlePostUpdated);
            off("postDeleted", handlePostDeleted);
            console.log("🧹 Real-time post listeners cleaned up");
        };
    }, [socket, on, off, setPosts]);
};
