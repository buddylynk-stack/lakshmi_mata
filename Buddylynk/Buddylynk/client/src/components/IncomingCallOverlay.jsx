import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { SafeAvatar } from "./SafeImage";

const IncomingCallOverlay = () => {
    const navigate = useNavigate();
    const { incomingCall, dismissIncomingCall, socket } = useNotifications();

    if (!incomingCall) return null;

    const { from, callType } = incomingCall;

    const handleAccept = () => {
        // Navigate to chat with the caller and pass call data
        navigate("/chat", { 
            state: { 
                selectedUser: from,
                incomingCall: incomingCall
            } 
        });
        dismissIncomingCall();
    };

    const handleDecline = () => {
        if (socket) {
            socket.emit("call:end", { to: from.userId });
        }
        dismissIncomingCall();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -100 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md"
            >
                <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-4 shadow-2xl">
                    <div className="flex items-center gap-4">
                        <SafeAvatar
                            src={from?.avatar}
                            alt={from?.username}
                            fallbackText={from?.username}
                            className="w-14 h-14 rounded-full ring-2 ring-white/30"
                        />
                        <div className="flex-1">
                            <h3 className="text-white font-semibold text-lg">{from?.username}</h3>
                            <p className="text-white/80 text-sm flex items-center gap-1">
                                {callType === "video" ? (
                                    <>
                                        <Video className="w-4 h-4" />
                                        Incoming video call...
                                    </>
                                ) : (
                                    <>
                                        <Phone className="w-4 h-4" />
                                        Incoming voice call...
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={handleDecline}
                                className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                <PhoneOff className="w-5 h-5 text-white" />
                            </motion.button>
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={handleAccept}
                                className="p-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                            >
                                <Phone className="w-5 h-5 text-white" />
                            </motion.button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default IncomingCallOverlay;
