import { createContext, useState, useContext, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext();

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = "success", duration = 3000) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type };
        
        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Convenience methods
    const success = useCallback((message, duration) => addToast(message, "success", duration), [addToast]);
    const error = useCallback((message, duration) => addToast(message, "error", duration), [addToast]);
    const warning = useCallback((message, duration) => addToast(message, "warning", duration), [addToast]);
    const info = useCallback((message, duration) => addToast(message, "info", duration), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};

const ToastContainer = ({ toasts, removeToast }) => {
    const getIcon = (type) => {
        switch (type) {
            case "success": return <CheckCircle className="w-5 h-5" />;
            case "error": return <XCircle className="w-5 h-5" />;
            case "warning": return <AlertTriangle className="w-5 h-5" />;
            case "info": return <Info className="w-5 h-5" />;
            default: return <CheckCircle className="w-5 h-5" />;
        }
    };

    const getStyles = (type) => {
        switch (type) {
            case "success": return "bg-green-500/90 text-white border-green-400";
            case "error": return "bg-red-500/90 text-white border-red-400";
            case "warning": return "bg-yellow-500/90 text-black border-yellow-400";
            case "info": return "bg-blue-500/90 text-white border-blue-400";
            default: return "bg-green-500/90 text-white border-green-400";
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 50, scale: 0.9 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl pointer-events-auto ${getStyles(toast.type)}`}
                    >
                        <div className="flex-shrink-0">
                            {getIcon(toast.type)}
                        </div>
                        <p className="flex-1 text-sm font-medium">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ToastProvider;
