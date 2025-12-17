import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle, AlertCircle, Upload } from "lucide-react";

const LoadingIndicator = ({ 
    message = "Processing...", 
    progress = null, 
    success = false,
    error = false,
    show = true 
}) => {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50"
                >
                    <div className="glass-panel p-3 sm:p-4 min-w-0 sm:min-w-[300px] shadow-2xl border border-white/20">
                        <div className="flex items-center gap-4">
                            {/* Icon */}
                            <div className="relative">
                                {success ? (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: "spring", stiffness: 300 }}
                                        className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center"
                                    >
                                        <CheckCircle className="w-6 h-6 text-green-500" />
                                    </motion.div>
                                ) : error ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center"
                                    >
                                        <AlertCircle className="w-6 h-6 text-red-500" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    >
                                        <Loader2 className="w-6 h-6 text-primary" />
                                    </motion.div>
                                )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1">
                                <motion.p 
                                    className={`text-sm font-medium ${
                                        success ? "text-green-500" : 
                                        error ? "text-red-500" : 
                                        "dark:text-white text-gray-900"
                                    }`}
                                    key={message}
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {message}
                                </motion.p>
                                
                                {/* Progress Bar */}
                                {progress !== null && !success && !error && (
                                    <div className="mt-2">
                                        <div className="flex justify-between text-xs text-theme-secondary mb-1">
                                            <span>Progress</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 0.3, ease: "easeOut" }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Skeleton Loader Component
export const Skeleton = ({ className = "", variant = "text" }) => {
    const variants = {
        text: "h-4 rounded",
        title: "h-6 rounded",
        avatar: "rounded-full",
        card: "rounded-xl",
        button: "h-10 rounded-xl",
    };

    return (
        <div className={`skeleton ${variants[variant]} ${className}`} />
    );
};

// Full Page Loader
export const PageLoader = ({ message = "Loading..." }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-8 text-center"
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 mx-auto mb-4"
                >
                    <Loader2 className="w-full h-full text-primary" />
                </motion.div>
                <p className="text-theme-secondary">{message}</p>
            </motion.div>
        </div>
    );
};

// Inline Spinner
export const Spinner = ({ size = "md", className = "" }) => {
    const sizes = {
        sm: "w-4 h-4",
        md: "w-6 h-6",
        lg: "w-8 h-8",
        xl: "w-12 h-12",
    };

    return (
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className={`${sizes[size]} ${className}`}
        >
            <Loader2 className="w-full h-full text-primary" />
        </motion.div>
    );
};

export default LoadingIndicator;
