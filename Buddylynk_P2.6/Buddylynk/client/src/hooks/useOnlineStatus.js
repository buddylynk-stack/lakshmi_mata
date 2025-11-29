import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

/**
 * Custom hook to track online/offline status of users in real-time
 * 
 * @param {string|string[]} userIds - Single userId or array of userIds to track
 * @returns {Object} - Object with userId as key and boolean online status as value
 */
export const useOnlineStatus = (userIds) => {
    const { socket, on, off } = useSocket();
    const [onlineStatus, setOnlineStatus] = useState({});
    const [loading, setLoading] = useState(true);

    // Normalize userIds to always be an array
    const userIdArray = Array.isArray(userIds) ? userIds : userIds ? [userIds] : [];

    useEffect(() => {
        if (userIdArray.length === 0) {
            setLoading(false);
            return;
        }

        // Fetch initial online status
        const fetchInitialStatus = async () => {
            try {
                const response = await axios.post('/api/users/online-status', {
                    userIds: userIdArray
                });
                setOnlineStatus(response.data);
            } catch (error) {
                console.error('Error fetching online status:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialStatus();
    }, [JSON.stringify(userIdArray)]);

    useEffect(() => {
        if (!socket) return;

        // Listen for user online events
        const handleUserOnline = ({ userId }) => {
            if (userIdArray.includes(userId)) {
                setOnlineStatus(prev => ({
                    ...prev,
                    [userId]: true
                }));
                console.log(`🟢 User ${userId} is now online`);
            }
        };

        // Listen for user offline events
        const handleUserOffline = ({ userId }) => {
            if (userIdArray.includes(userId)) {
                setOnlineStatus(prev => ({
                    ...prev,
                    [userId]: false
                }));
                console.log(`⚫ User ${userId} is now offline`);
            }
        };

        on('userOnline', handleUserOnline);
        on('userOffline', handleUserOffline);

        return () => {
            off('userOnline', handleUserOnline);
            off('userOffline', handleUserOffline);
        };
    }, [socket, on, off, JSON.stringify(userIdArray)]);

    return { onlineStatus, loading };
};

/**
 * Hook to track a single user's online status
 * 
 * @param {string} userId - User ID to track
 * @returns {Object} - { isOnline: boolean, loading: boolean }
 */
export const useSingleUserOnlineStatus = (userId) => {
    const { onlineStatus, loading } = useOnlineStatus(userId);
    
    return {
        isOnline: onlineStatus[userId] || false,
        loading
    };
};
