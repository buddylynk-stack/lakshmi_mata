import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, CheckCircle, Info } from "lucide-react";

const ConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = "Confirm", 
    cancelText = "Cancel", 
    type = "danger" 
}) => {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    const icons = {
        danger: AlertTriangle,
        warning: AlertTriangle,
        success: CheckCircle,
        info: Info,
    };

    const colors = {
        danger: {
            bg: "bg-red-500/20",
            text: "text-red-500",
            button: "bg-red-500 hover:bg-red-600",
        },
        warning: {
            bg: "bg-yellow-500/20",
            text: "text-yellow-500",
            button: "bg-yellow-500 hover:bg-yellow-600",
        },
        success: {
            bg: "bg-green-500/20",
            text: "text-green-500",
            button: "bg-green-500 hover:bg-green-600",
        },
        info: {
            bg: "bg-primary/20",
            text: "text-primary",
            button: "bg-primary hover:bg-primary-hover",
        },
    };

    const Icon = icons[type] || AlertTriangle;
    const colorScheme = colors[type] || colors.danger;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-[10000] p-0 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 100 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="glass-panel rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/20"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Swipe Indicator (Mobile) */}
                            <div className="sm:hidden w-10 h-1 bg-gray-400 rounded-full mx-auto mt-3 mb-2" />
                            
                            {/* Header */}
                            <div className="p-4 sm:p-6 border-b dark:border-white/10 border-gray-200">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <motion.div 
                                            className={`p-3 rounded-xl ${colorScheme.bg} ${colorScheme.text}`}
                                            initial={{ rotate: -10, scale: 0 }}
                                            animate={{ rotate: 0, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, delay: 0.1 }}
                                        >
                                            <Icon className="w-6 h-6" />
                                        </motion.div>
                                        <motion.h3 
                                            className="text-xl font-bold dark:text-white text-gray-900"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.15 }}
                                        >
                                            {title}
                                        </motion.h3>
                                    </div>
                                    <motion.button
                                        onClick={onClose}
                                        className="p-2 rounded-lg dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/10 hover:bg-gray-100 transition-all"
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </div>

                            {/* Body */}
                            <motion.div 
                                className="p-4 sm:p-6"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <p className="dark:text-gray-300 text-gray-700 text-sm sm:text-base leading-relaxed">
                                    {message}
                                </p>
                            </motion.div>

                            {/* Footer */}
                            <motion.div 
                                className="p-4 sm:p-6 border-t dark:border-white/10 border-gray-200 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end safe-bottom"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                            >
                                <motion.button
                                    onClick={onClose}
                                    className="btn-secondary w-full sm:w-auto"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {cancelText}
                                </motion.button>
                                <motion.button
                                    onClick={handleConfirm}
                                    className={`px-6 py-3 rounded-xl text-white font-semibold transition-all w-full sm:w-auto ${colorScheme.button}`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {confirmText}
                                </motion.button>
                            </motion.div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ConfirmModal;
