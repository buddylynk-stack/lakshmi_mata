/**
 * Connection Status Indicator
 * Shows real-time WebSocket connection status with animations
 */

import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useSocket } from "../context/SocketContext";

const ConnectionStatus = () => {
    const { isConnected, reconnectAttempts } = useSocket();

    const getStatus = () => {
        if (isConnected) return { 
            color: "bg-green-500", 
            glow: "shadow-green-500/50",
            text: "Connected", 
            icon: Wifi,
            bgColor: "bg-green-500/10 border-green-500/30"
        };
        if (reconnectAttempts > 0) return { 
            color: "bg-yellow-500", 
            glow: "shadow-yellow-500/50",
            text: `Reconnecting...`, 
            icon: RefreshCw,
            bgColor: "bg-yellow-500/10 border-yellow-500/30"
        };
        return { 
            color: "bg-red-500", 
            glow: "shadow-red-500/50",
            text: "Disconnected", 
            icon: WifiOff,
            bgColor: "bg-red-500/10 border-red-500/30"
        };
    };

    const status = getStatus();
    const Icon = status.icon;

    // Only show when not connected or reconnecting
    if (isConnected && reconnectAttempts === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl border ${status.bgColor}`}
            >
                <motion.div
                    animate={{ 
                        scale: [1, 1.2, 1],
                        boxShadow: [`0 0 0 0 ${status.color}`, `0 0 10px 2px ${status.color}`, `0 0 0 0 ${status.color}`]
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`w-3 h-3 rounded-full ${status.color} shadow-lg ${status.glow}`}
                />
                <motion.div
                    animate={reconnectAttempts > 0 ? { rotate: 360 } : {}}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                    <Icon className={`w-4 h-4 ${
                        isConnected ? "text-green-500" : 
                        reconnectAttempts > 0 ? "text-yellow-500" : "text-red-500"
                    }`} />
                </motion.div>
                <span className={`text-sm font-medium ${
                    isConnected ? "text-green-500" : 
                    reconnectAttempts > 0 ? "text-yellow-500" : "text-red-500"
                }`}>
                    {status.text}
                </span>
                {reconnectAttempts > 0 && (
                    <span className="text-xs text-yellow-500/70">
                        Attempt {reconnectAttempts}
                    </span>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default ConnectionStatus;
