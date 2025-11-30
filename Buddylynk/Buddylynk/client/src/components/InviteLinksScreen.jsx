import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    MoreVertical,
    Copy,
    QrCode,
    Share2,
    Trash2,
    Plus
} from "lucide-react";
import { SafeImage } from "./SafeImage";
import axios from "axios";

const InviteLinksScreen = ({ 
    isOpen, 
    onClose, 
    group, 
    onInviteLinkUpdated 
}) => {
    const [showLinkMenu, setShowLinkMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [showQRCode, setShowQRCode] = useState(false);
    const [currentInviteCode, setCurrentInviteCode] = useState(group?.inviteCode);

    // Update currentInviteCode when group prop changes
    if (group?.inviteCode !== currentInviteCode && group?.inviteCode && !isRegenerating) {
        setCurrentInviteCode(group.inviteCode);
    }

    // Generate the full invite link URL - use inviteCode if available (allows revokable links)
    const getInviteUrl = () => {
        if (currentInviteCode) {
            return `${window.location.origin}/invite/${currentInviteCode}`;
        }
        return `${window.location.origin}/groups/${group?.groupId}`;
    };

    const inviteLink = getInviteUrl();
    const shortLink = inviteLink.replace(window.location.origin, 'buddylynk.com');

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: group?.name,
                    text: `Join ${group?.name} on Buddylynk!`,
                    url: inviteLink
                });
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            handleCopyLink();
        }
    };

    const handleRevokeLink = async () => {
        if (isRegenerating) return;
        
        setIsRegenerating(true);
        setShowLinkMenu(false);
        
        try {
            const token = localStorage.getItem("token");
            console.log("🔄 Deleting old URL and generating new one...");
            console.log("📤 Calling API: /api/groups/" + group.groupId + "/regenerate-invite");
            console.log("🔑 Token exists:", !!token);
            
            const response = await axios.post(`/api/groups/${group.groupId}/regenerate-invite`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log("📥 API Response:", response.data);
            
            if (response.data) {
                // Update local state immediately with new invite code
                const newInviteCode = response.data.inviteCode;
                console.log("🆕 New invite code:", newInviteCode);
                console.log("🔗 Old invite code:", currentInviteCode);
                
                if (newInviteCode) {
                    setCurrentInviteCode(newInviteCode);
                    console.log("✅ URL updated successfully! New URL: buddylynk.com/invite/" + newInviteCode);
                    // Notify parent component about the updated group
                    onInviteLinkUpdated?.(response.data);
                } else {
                    console.error("❌ No inviteCode in response! Full response:", JSON.stringify(response.data));
                    alert("Error: Server did not return a new invite code");
                }
            }
        } catch (error) {
            console.error("❌ Failed to regenerate invite link:", error);
            console.error("Error details:", error.response?.data || error.message);
            alert("Failed to delete URL: " + (error.response?.data?.message || error.message));
        } finally {
            setIsRegenerating(false);
        }
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
                        className="fixed inset-0 bg-black/50 z-[60] md:pl-72"
                    />

                    {/* Invite Links Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 w-full md:w-[420px] md:ml-72 bg-[#111b21] z-[60] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="text-[#aebac1] hover:text-white p-1 transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h2 className="text-white text-lg font-medium flex-1">Invite Links</h2>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Channel Icon & Description */}
                            <div className="flex flex-col items-center py-8 px-4">
                                {/* Channel Avatar */}
                                <div className="w-24 h-24 rounded-full overflow-hidden mb-4">
                                    {group?.coverImage ? (
                                        <SafeImage
                                            src={group.coverImage}
                                            alt={group.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                                            <span className="text-4xl">🦆</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Description */}
                                <p className="text-[#8696a0] text-sm text-center max-w-[280px]">
                                    Anyone on Buddylynk will be able to join your channel by following this link.
                                </p>
                            </div>

                            {/* Invite Link Section */}
                            <div className="px-4">
                                <h3 className="text-[#00a884] text-sm font-medium mb-3">
                                    Invite Link
                                </h3>

                                {/* Link Card */}
                                <div className="bg-[#202c33] rounded-lg">
                                    {/* Link Display with Menu */}
                                    <div className="flex items-center px-4 py-3">
                                        <p className="flex-1 text-white text-sm truncate">
                                            {shortLink}
                                        </p>
                                        
                                        {/* Three-dot menu */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowLinkMenu(!showLinkMenu)}
                                                className="text-[#aebac1] hover:text-white p-2 transition-colors"
                                            >
                                                <MoreVertical className="w-5 h-5" />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {showLinkMenu && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-[100]"
                                                        onClick={() => setShowLinkMenu(false)}
                                                    />
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-[#233138] rounded-lg shadow-xl border border-[#2a3942] z-[101]">
                                                        <button
                                                            onClick={() => {
                                                                setShowLinkMenu(false);
                                                                setShowQRCode(true);
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#2a3942] transition-colors rounded-t-lg"
                                                        >
                                                            <QrCode className="w-5 h-5 text-[#8696a0]" />
                                                            <span>Get QR code</span>
                                                        </button>
                                                        <button
                                                            onClick={handleRevokeLink}
                                                            disabled={isRegenerating}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-[#2a3942] transition-colors disabled:opacity-50 rounded-b-lg"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                            <span>{isRegenerating ? 'Deleting...' : 'Delete URL'}</span>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex border-t border-[#2a3942]">
                                        <button
                                            onClick={handleCopyLink}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 text-[#00a884] hover:bg-[#2a3942] transition-colors border-r border-[#2a3942]"
                                        >
                                            <Copy className="w-5 h-5" />
                                            <span className="text-sm font-medium">
                                                {copied ? 'Copied!' : 'Copy'}
                                            </span>
                                        </button>
                                        <button
                                            onClick={handleShare}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 text-[#00a884] hover:bg-[#2a3942] transition-colors"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            <span className="text-sm font-medium">Share</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Create New Link Option */}
                            <div className="px-4 mt-6">
                                <button className="flex items-center gap-3 text-[#00a884] py-3">
                                    <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <span className="text-sm font-medium">Create a New Link</span>
                                </button>
                                
                                <p className="text-[#8696a0] text-xs mt-2 ml-13 pl-13">
                                    You can create additional invite links that have limited time, number of users or require a paid subscription.
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* QR Code Modal */}
                    <AnimatePresence>
                        {showQRCode && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowQRCode(false)}
                                    className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center"
                                >
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.9, opacity: 0 }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-[#202c33] rounded-xl p-6 max-w-sm mx-4"
                                    >
                                        <h3 className="text-white text-lg font-medium text-center mb-4">
                                            QR Code
                                        </h3>
                                        <div className="bg-white p-4 rounded-lg">
                                            {/* QR Code placeholder - you can integrate a QR library */}
                                            <div className="w-48 h-48 mx-auto flex items-center justify-center bg-gray-100 rounded">
                                                <QrCode className="w-32 h-32 text-gray-800" />
                                            </div>
                                        </div>
                                        <p className="text-[#8696a0] text-xs text-center mt-4">
                                            {shortLink}
                                        </p>
                                        <button
                                            onClick={() => setShowQRCode(false)}
                                            className="w-full mt-4 py-2 bg-[#00a884] text-white rounded-lg font-medium"
                                        >
                                            Close
                                        </button>
                                    </motion.div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );
};

export default InviteLinksScreen;
