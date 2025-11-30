/**
 * Socket Context - Production-Grade WebSocket Management
 * 
 * Features:
 * - Single persistent WebSocket connection
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong for connection health
 * - Prevents duplicate socket instances
 * - Memory leak prevention
 * - Event listener cleanup
 */

import { createContext, useState, useEffect, useContext, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import io from "socket.io-client";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const socketRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    // Socket configuration - Use domain in production, localhost in development
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
        (import.meta.env.PROD ? "https://buddylynk.com" : "http://localhost:5000");
    const MAX_RECONNECT_ATTEMPTS = 10;
    const HEARTBEAT_INTERVAL = 30000; // 30 seconds
    const RECONNECT_DELAY_BASE = 1000; // 1 second

    /**
     * Initialize socket connection
     */
    const initializeSocket = useCallback(() => {
        if (!user || socketRef.current) return;

        console.log("🔌 Initializing socket connection...");

        const newSocket = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'], // Prefer WebSocket
            reconnection: true,
            reconnectionDelay: RECONNECT_DELAY_BASE,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            timeout: 20000,
            autoConnect: true,
        });

        // Connection event handlers
        newSocket.on('connect', () => {
            console.log('✅ Socket connected:', newSocket.id);
            setIsConnected(true);
            setReconnectAttempts(0);
            
            // Register user with server
            newSocket.emit("register", user.userId);
            
            // Start heartbeat
            startHeartbeat(newSocket);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason);
            setIsConnected(false);
            stopHeartbeat();
            
            // Handle different disconnect reasons
            if (reason === 'io server disconnect') {
                // Server disconnected, manually reconnect
                newSocket.connect();
            }
        });

        newSocket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
            setReconnectAttempts(0);
            newSocket.emit("register", user.userId);
        });

        newSocket.on('reconnect_attempt', (attemptNumber) => {
            console.log('🔄 Reconnection attempt', attemptNumber);
            setReconnectAttempts(attemptNumber);
        });

        newSocket.on('reconnect_error', (error) => {
            console.error('❌ Reconnection error:', error.message);
        });

        newSocket.on('reconnect_failed', () => {
            console.error('❌ Reconnection failed after maximum attempts');
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
            setIsConnected(false);
        });

        // Heartbeat response
        newSocket.on('heartbeat', (data) => {
            // Server sent heartbeat, respond with pong
            newSocket.emit('pong');
        });

        newSocket.on('pong', () => {
            // Server responded to our ping
            // Connection is healthy
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        // Make socket globally available for debugging
        if (import.meta.env.DEV) {
            window.socket = newSocket;
        }

    }, [user, SOCKET_URL]);

    /**
     * Start heartbeat to monitor connection health
     */
    const startHeartbeat = (socket) => {
        stopHeartbeat(); // Clear any existing interval
        
        heartbeatIntervalRef.current = setInterval(() => {
            if (socket && socket.connected) {
                socket.emit('ping');
            }
        }, HEARTBEAT_INTERVAL);
    };

    /**
     * Stop heartbeat
     */
    const stopHeartbeat = () => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    };

    /**
     * Disconnect socket
     */
    const disconnectSocket = useCallback(() => {
        if (socketRef.current) {
            console.log("🔌 Disconnecting socket...");
            stopHeartbeat();
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
            
            if (import.meta.env.DEV) {
                window.socket = null;
            }
        }
    }, []);

    /**
     * Emit event to server
     */
    const emit = useCallback((event, data) => {
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit(event, data);
        } else {
            console.warn(`Cannot emit ${event}: Socket not connected`);
        }
    }, []);

    /**
     * Subscribe to event
     */
    const on = useCallback((event, callback) => {
        if (socketRef.current) {
            socketRef.current.on(event, callback);
        }
    }, []);

    /**
     * Unsubscribe from event
     */
    const off = useCallback((event, callback) => {
        if (socketRef.current) {
            socketRef.current.off(event, callback);
        }
    }, []);

    // Initialize socket when user logs in
    useEffect(() => {
        if (user) {
            initializeSocket();
        } else {
            disconnectSocket();
        }

        // Cleanup on unmount
        return () => {
            disconnectSocket();
        };
    }, [user, initializeSocket, disconnectSocket]);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            stopHeartbeat();
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, []);

    const value = {
        socket,
        isConnected,
        reconnectAttempts,
        emit,
        on,
        off,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
