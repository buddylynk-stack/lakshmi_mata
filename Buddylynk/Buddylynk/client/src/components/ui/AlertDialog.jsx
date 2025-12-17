import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, X } from "lucide-react";

// Shadcn-style Alert Dialog - Mobile Optimized & Centered
export const AlertDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Continue",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading = false
}) => {
  const variants = {
    destructive: {
      icon: Trash2,
      iconBg: "bg-red-100 dark:bg-red-500/20",
      iconColor: "text-red-500",
      buttonBg: "bg-red-500 hover:bg-red-600 active:bg-red-700",
      buttonText: "text-white"
    },
    warning: {
      icon: AlertTriangle,
      iconBg: "bg-yellow-100 dark:bg-yellow-500/20",
      iconColor: "text-yellow-500",
      buttonBg: "bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700",
      buttonText: "text-black"
    },
    default: {
      icon: AlertTriangle,
      iconBg: "bg-blue-100 dark:bg-blue-500/20",
      iconColor: "text-blue-500",
      buttonBg: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
      buttonText: "text-white"
    }
  };

  const style = variants[variant] || variants.default;
  const Icon = style.icon;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const dialogContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative w-full max-w-sm bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Content */}
            <div className="p-5 text-center">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className={`mx-auto w-14 h-14 rounded-full ${style.iconBg} flex items-center justify-center mb-4`}
              >
                <Icon className={`w-7 h-7 ${style.iconColor}`} />
              </motion.div>

              {/* Title */}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h2>

              {/* Description */}
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
                {description}
              </p>

              {/* Buttons - Stacked on mobile for better touch targets */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-3 rounded-xl ${style.buttonBg} ${style.buttonText} font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {isLoading ? (
                    <>
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(dialogContent, document.body);
  }
  return dialogContent;
};

export default AlertDialog;
