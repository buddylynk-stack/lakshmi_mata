/**
 * Custom Hook for Real-Time Group Updates
 * 
 * Manages WebSocket listeners for group-related events:
 * - New groups created
 * - Group updates (join, leave, new posts)
 * - Group deletions
 * 
 * Prevents duplicate listeners and memory leaks
 */

import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";

export const useRealTimeGroups = (setGroups) => {
    const { socket, on, off } = useSocket();
    const { user } = useAuth();

    useEffect(() => {
        if (!socket) return;

        // Helper to check if user can see a private group
        const canSeeGroup = (group) => {
            if (group.visibility !== 'private') return true;
            if (!user) return false;
            return group.creatorId === user.userId || group.members?.includes(user.userId);
        };

        // Handler for new groups
        const handleGroupCreated = (newGroup) => {
            console.log("📢 New group created:", newGroup.groupId);
            
            // Don't add private groups that user can't see
            if (!canSeeGroup(newGroup)) {
                console.log("🔒 Private group, user not a member, skipping:", newGroup.groupId);
                return;
            }
            
            setGroups(prevGroups => {
                // Prevent duplicates
                const exists = prevGroups.some(group => group.groupId === newGroup.groupId);
                if (exists) {
                    console.log("Group already exists, skipping:", newGroup.groupId);
                    return prevGroups;
                }
                return [newGroup, ...prevGroups];
            });
        };

        // Handler for group updates
        const handleGroupUpdated = (data) => {
            const { groupId, group, action, userId: actionUserId } = data;
            console.log("🔄 Group updated:", groupId, "Action:", action);
            
            setGroups(prevGroups => {
                const existingIndex = prevGroups.findIndex(g => g.groupId === groupId);
                
                // If user just joined a private group, add it to their list
                if (action === 'join' && actionUserId === user?.userId && existingIndex === -1) {
                    console.log("📥 Adding newly joined group to list:", groupId);
                    return [group, ...prevGroups];
                }
                
                // If user left a private group, remove it from their list
                if (action === 'leave' && actionUserId === user?.userId && group.visibility === 'private') {
                    console.log("📤 Removing left private group from list:", groupId);
                    return prevGroups.filter(g => g.groupId !== groupId);
                }
                
                // Update existing group
                if (existingIndex !== -1) {
                    return prevGroups.map(g => g.groupId === groupId ? group : g);
                }
                
                return prevGroups;
            });
        };

        // Handler for group deletions
        const handleGroupDeleted = (deletedGroupId) => {
            console.log("🗑️ Group deleted:", deletedGroupId);
            setGroups(prevGroups =>
                prevGroups.filter(group => group.groupId !== deletedGroupId)
            );
        };

        // Subscribe to events
        on("groupCreated", handleGroupCreated);
        on("groupUpdated", handleGroupUpdated);
        on("groupDeleted", handleGroupDeleted);

        console.log("✅ Real-time group listeners registered");

        // Cleanup listeners on unmount
        return () => {
            off("groupCreated", handleGroupCreated);
            off("groupUpdated", handleGroupUpdated);
            off("groupDeleted", handleGroupDeleted);
            console.log("🧹 Real-time group listeners cleaned up");
        };
    }, [socket, on, off, setGroups, user]);
};
