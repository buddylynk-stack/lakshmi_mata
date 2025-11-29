import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

/**
 * Custom hook to track total unread messages count using Redis
 * 
 * @returns {Object} - { unreadCount: number, loading: boolean }
 */
export const useUnreadMessages = () => {
    const { user } = useAuth();
    const { socket, on, off } = useSocket();
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch initial unread count from Redis
    useEffect(() => {
        if (!user) return;

        const fetchUnreadCount = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('/api/messages/unread-count', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                setUnreadCount(response.data.unreadCount || 0);
                console.log('📬 Initial unread count:', response.data.unreadCount);
            } catch (error) {
                console.error('Error fetching unread count:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUnreadCount();
    }, [user]);

    // Memoize the handler to prevent dependency issues
    const handleUnreadCountUpdate = useCallback(({ unreadCount: newCount }) => {
        setUnreadCount(newCount);
        console.log('📬 Unread count updated via Redis:', newCount);
    }, []);

    // Listen for real-time unread count updates from Redis
    useEffect(() => {
        if (!socket || !user) return;

        on('unreadCountUpdated', handleUnreadCountUpdate);

        return () => {
            off('unreadCountUpdated', handleUnreadCountUpdate);
        };
    }, [socket, user, on, off, handleUnreadCountUpdate]);

    return { unreadCount, loading };
};
