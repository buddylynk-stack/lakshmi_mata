/**
 * SensitiveMediaWrapper - Handles show/blur/hide for sensitive content
 * Respects user's sensitiveContentSetting from localStorage
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";

const SensitiveMediaWrapper = ({ children, isSensitive = false, className = "" }) => {
    const [revealed, setRevealed] = useState(false);
    
    // Get user's preference from localStorage
    const sensitiveContentSetting = localStorage.getItem("sensitiveContentSetting") || "blur";
    
    // If content is not sensitive, or user chose "show", render normally
    if (!isSensitive || sensitiveContentSetting === "show") {
        return <div className={className}>{children}</div>;
    }
    
    // If user chose "hide", show a placeholder message
    if (sensitiveContentSetting === "hide") {
        return (
            <div className={`${className} relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl flex items-center justify-center min-h-[200px] border border-white/10`}>
                <div className="text-center p-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center">
                        <EyeOff className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-300 font-medium mb-2">18+ Content Hidden</p>
                    <p className="text-gray-500 text-sm max-w-[200px] mx-auto">
                        You've turned off sensitive content in Settings
                    </p>
                    <p className="text-gray-600 text-xs mt-3">
                        Settings → Sensitive Content → Show/Blur
                    </p>
                </div>
            </div>
        );
    }
    
    // Default: "blur" - show blurred with reveal option
    if (!revealed) {
        return (
            <div className={`${className} relative`}>
                {/* Blurred content */}
                <div className="blur-xl filter brightness-50 pointer-events-none">
                    {children}
                </div>
                
                {/* Overlay with reveal button - simplified for performance */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl">
                    <AlertTriangle className="w-10 h-10 text-orange-500 mb-3" />
                    <p className="text-white font-medium mb-1">Sensitive Content</p>
                    <p className="text-gray-300 text-sm mb-4">This content may be sensitive</p>
                    <button
                        onClick={() => setRevealed(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors active:scale-95"
                    >
                        <Eye className="w-4 h-4" />
                        <span>Show Content</span>
                    </button>
                </div>
            </div>
        );
    }
    
    // Content revealed
    return (
        <div className={`${className} relative`}>
            {children}
            {/* Small indicator that content was revealed */}
            <button
                onClick={() => setRevealed(false)}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white/70 hover:text-white transition-colors z-10"
                title="Hide content"
            >
                <EyeOff className="w-4 h-4" />
            </button>
        </div>
    );
};

export default SensitiveMediaWrapper;
