import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LogIn, X, Sparkles } from "lucide-react";

const LoginPrompt = ({ isOpen, onClose, message = "Please login to continue" }) => {
    const navigate = useNavigate();

    const handleLogin = () => {
        onClose();
        navigate("/login");
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />
                    
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-[101] p-4"
                    >
                        <div className="glass-panel rounded-2xl p-6 max-w-sm w-full border border-white/20 shadow-2xl">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>

                            {/* Icon */}
                            <div className="flex justify-center mb-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-white" />
                                </div>
                            </div>

                            {/* Title */}
                            <h2 className="text-xl font-bold text-center dark:text-white text-gray-900 mb-2">
                                Join Buddylynk
                            </h2>

                            {/* Message */}
                            <p className="text-center dark:text-gray-400 text-gray-600 mb-6">
                                {message}
                            </p>

                            {/* Buttons */}
                            <div className="space-y-3">
                                <motion.button
                                    onClick={handleLogin}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <LogIn className="w-5 h-5" />
                                    Login / Sign Up
                                </motion.button>
                                
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 px-4 dark:text-gray-400 text-gray-600 rounded-xl font-medium hover:bg-white/5 transition-colors"
                                >
                                    Continue Browsing
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default LoginPrompt;
