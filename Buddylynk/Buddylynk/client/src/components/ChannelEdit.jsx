import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Check,
    Camera,
    Globe,
    Lock,
    Shield,
    Users,
    UserX,
    Megaphone,
    ChevronRight,
    Trash2,
    MoreVertical
} from "lucide-react";
import { SafeImage } from "./SafeImage";
import SubscribersList from "./SubscribersList";
import RemovedUsersList from "./RemovedUsersList";

const ChannelEdit = ({
    isOpen,
    onClose,
    group,
    onSave,
    onDelete,
    currentUserId
}) => {
    const [channelName, setChannelName] = useState(group?.name || "");
    const [description, setDescription] = useState(group?.description || "");
    const [channelType, setChannelType] = useState(group?.privacy || "public");
    // For channels: default to false, for groups: use saved value or default to true
    const getInitialAllowMembersToChat = (g) => {
        if (!g) return true;
        // If value is explicitly set in database, use it
        if (g.allowMembersToChat !== undefined && g.allowMembersToChat !== null) {
            return g.allowMembersToChat === true;
        }
        // Default: false for channels, true for groups
        return g.type !== 'channel';
    };
    const [allowMembersToChat, setAllowMembersToChat] = useState(() => getInitialAllowMembersToChat(group));
    const [newPhoto, setNewPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showSubscribers, setShowSubscribers] = useState(false);
    const [showRemovedUsers, setShowRemovedUsers] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const fileInputRef = useRef(null);

    // Track if any changes have been made
    const hasChanges = () => {
        if (!group) return false;
        return (
            channelName.trim() !== (group.name || "") ||
            description.trim() !== (group.description || "") ||
            channelType !== (group.privacy || "public") ||
            allowMembersToChat !== getInitialAllowMembersToChat(group) ||
            newPhoto !== null
        );
    };

    // Sync state when group prop changes or modal opens
    useEffect(() => {
        if (isOpen && group) {
            setChannelName(group.name || "");
            setDescription(group.description || "");
            setChannelType(group.privacy || "public");
            // Use the actual saved value from database
            setAllowMembersToChat(getInitialAllowMembersToChat(group));
            setNewPhoto(null);
            setPhotoPreview(null);
            console.log("📋 ChannelEdit loaded - allowMembersToChat from DB:", group.allowMembersToChat, "-> state:", getInitialAllowMembersToChat(group));
        }
    }, [isOpen, group]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!channelName.trim()) return;
        
        setSaving(true);
        console.log("💾 Saving group with allowMembersToChat:", allowMembersToChat, "type:", typeof allowMembersToChat);
        try {
            await onSave?.({
                name: channelName.trim(),
                description: description.trim(),
                privacy: channelType,
                allowMembersToChat: allowMembersToChat,
                photo: newPhoto
            });
            onClose();
        } catch (error) {
            console.error("Error saving:", error);
        } finally {
            setSaving(false);
        }
    };

    const menuItems = [
        {
            icon: channelType === "public" ? Globe : Lock,
            iconBg: "bg-[#00a884]/20",
            iconColor: "text-[#00a884]",
            title: "Channel type",
            subtitle: channelType === "public" ? "Public" : "Private",
            onClick: () => setChannelType(channelType === "public" ? "private" : "public")
        }
    ];

    const managementItems = [
        {
            icon: Shield,
            iconBg: "bg-[#5865f2]/20",
            iconColor: "text-[#5865f2]",
            title: "Administrators",
            count: (group?.admins?.length || 0) + 1,
            clickable: true,
            onClick: () => setShowSubscribers(true) // Show subscribers filtered by admins
        },
        {
            icon: Users,
            iconBg: "bg-[#00a884]/20",
            iconColor: "text-[#00a884]",
            title: "Subscribers",
            count: group?.memberCount || group?.members?.length || 0,
            clickable: true, // Now clickable to show all subscribers
            onClick: () => setShowSubscribers(true)
        },
        {
            icon: UserX,
            iconBg: "bg-[#ef4444]/20",
            iconColor: "text-[#ef4444]",
            title: "Removed users",
            clickable: true,
            onClick: () => setShowRemovedUsers(true)
        }
    ];

    const analyticsItems = [
        {
            icon: Megaphone,
            iconBg: "bg-[#f97316]/20",
            iconColor: "text-[#f97316]",
            title: "Affiliate Programs",
            badge: "NEW",
            badgeColor: "bg-[#00a884]",
            onClick: () => {}
        }
    ];

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

                    {/* Edit Panel - Slide from right */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 w-full md:w-[420px] md:ml-72 dark:bg-[#111b21] bg-white z-[60] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="dark:bg-[#202c33] bg-gray-100 px-4 py-3 flex items-center gap-4 border-b dark:border-transparent border-gray-200">
                            <button
                                onClick={onClose}
                                className="dark:text-[#aebac1] text-gray-600 dark:hover:text-white hover:text-gray-900 p-1 transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <h2 className="dark:text-white text-gray-900 text-lg font-medium flex-1">Edit</h2>
                            
                            {/* Save Button - Only show when changes are made */}
                            <AnimatePresence>
                                {hasChanges() && (
                                    <motion.button
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                        onClick={handleSave}
                                        disabled={!channelName.trim() || saving}
                                        className={`p-2.5 rounded-full transition-all shadow-lg ${
                                            channelName.trim() && !saving
                                                ? "bg-[#00a884] text-white hover:bg-[#06cf9c] hover:scale-110"
                                                : "bg-[#3b4a54] text-[#8696a0] cursor-not-allowed"
                                        }`}
                                    >
                                        {saving ? (
                                            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Check className="w-6 h-6 stroke-[3]" />
                                        )}
                                    </motion.button>
                                )}
                            </AnimatePresence>
                            
                            {/* Three dots menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                                    className="dark:text-[#aebac1] text-gray-600 dark:hover:text-white hover:text-gray-900 p-2 transition-colors"
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                                
                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {showMoreMenu && (
                                        <>
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                onClick={() => setShowMoreMenu(false)}
                                                className="fixed inset-0 z-10"
                                            />
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                className="absolute right-0 top-full mt-1 dark:bg-[#233138] bg-white rounded-lg shadow-xl z-20 min-w-[180px] overflow-hidden border dark:border-transparent border-gray-200"
                                            >
                                                <button
                                                    onClick={() => {
                                                        setShowMoreMenu(false);
                                                        setShowDeleteConfirm(true);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:hover:bg-[#182229] hover:bg-red-50 transition-colors"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                    <span className="text-sm">Delete channel</span>
                                                </button>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Profile Photo & Name Section */}
                            <div className="dark:bg-[#111b21] bg-white px-4 py-6">
                                {/* Photo Upload */}
                                <div className="flex justify-center mb-6">
                                    <div className="relative">
                                        <div className="w-28 h-28 rounded-full overflow-hidden ring-4 dark:ring-[#2a3942] ring-gray-200">
                                            {photoPreview || group?.coverImage ? (
                                                <SafeImage
                                                    src={photoPreview || group?.coverImage}
                                                    alt={channelName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center">
                                                    <Users className="w-14 h-14 text-primary/60" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Camera Button */}
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="absolute bottom-0 right-0 w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center shadow-lg hover:bg-[#06cf9c] transition-colors"
                                        >
                                            <Camera className="w-5 h-5 text-white" />
                                        </button>
                                        
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoChange}
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                {/* Set Photo Button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-2 text-[#00a884] text-sm font-medium hover:bg-[#00a884]/10 rounded-lg transition-colors mb-6"
                                >
                                    Set Photo
                                </button>

                                {/* Channel Name Input */}
                                <div className="mb-4">
                                    <label className="block text-[#00a884] text-xs font-medium mb-2 px-1">
                                        Channel name
                                    </label>
                                    <input
                                        type="text"
                                        value={channelName}
                                        onChange={(e) => setChannelName(e.target.value)}
                                        placeholder="Enter channel name"
                                        className="w-full bg-transparent border-b-2 dark:border-[#2a3942] border-gray-300 focus:border-[#00a884] dark:text-white text-gray-900 py-2 px-1 outline-none transition-colors text-base dark:placeholder-[#8696a0] placeholder-gray-400"
                                    />
                                </div>

                                {/* Description Input */}
                                <div>
                                    <label className="block dark:text-[#8696a0] text-gray-500 text-xs font-medium mb-2 px-1">
                                        Description (optional)
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Add a description"
                                        rows={3}
                                        className="w-full bg-transparent border-b-2 dark:border-[#2a3942] border-gray-300 focus:border-[#00a884] dark:text-white text-gray-900 py-2 px-1 outline-none transition-colors text-sm resize-none dark:placeholder-[#8696a0] placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-2 dark:bg-[#0b141a] bg-gray-100" />

                            {/* Channel Settings */}
                            <div className="dark:bg-[#111b21] bg-white">
                                {menuItems.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={item.onClick}
                                        className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center`}>
                                            <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="dark:text-white text-gray-900 text-[15px]">{item.title}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.badge && (
                                                <span className="text-lg">{item.badge}</span>
                                            )}
                                            <span className="dark:text-[#8696a0] text-gray-500 text-sm">{item.subtitle}</span>
                                            <ChevronRight className="w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                        </div>
                                    </button>
                                ))}

                                {/* Allow Members to Chat Toggle - Show for both Groups and Channels */}
                                <button
                                    onClick={() => {
                                        const newValue = !allowMembersToChat;
                                        console.log("🔄 Toggle clicked - changing allowMembersToChat from", allowMembersToChat, "to", newValue);
                                        setAllowMembersToChat(newValue);
                                    }}
                                    className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-[#8b5cf6]" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="dark:text-white text-gray-900 text-[15px]">Allow members to chat</p>
                                        <p className="dark:text-[#8696a0] text-gray-500 text-xs">
                                            {allowMembersToChat ? "Everyone can send messages" : "Only admins can send messages"}
                                        </p>
                                    </div>
                                    {/* Toggle Switch */}
                                    <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                                        allowMembersToChat ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
                                    }`}>
                                        <motion.div
                                            className="w-5 h-5 bg-white rounded-full shadow-md"
                                            animate={{ x: allowMembersToChat ? 20 : 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </div>
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="h-2 dark:bg-[#0b141a] bg-gray-100" />

                            {/* Management Section */}
                            <div className="dark:bg-[#111b21] bg-white">
                                {managementItems.map((item, index) => 
                                    item.clickable !== false ? (
                                        <button
                                            key={index}
                                            onClick={item.onClick}
                                            className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors"
                                        >
                                            <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center`}>
                                                <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="dark:text-white text-gray-900 text-[15px]">{item.title}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {item.count !== undefined && (
                                                    <span className="dark:text-[#8696a0] text-gray-500 text-sm">{item.count}</span>
                                                )}
                                                <ChevronRight className="w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                            </div>
                                        </button>
                                    ) : (
                                        // Non-clickable item (like Subscribers - Telegram style)
                                        <div
                                            key={index}
                                            className="w-full flex items-center gap-4 px-4 py-3.5"
                                        >
                                            <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center`}>
                                                <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="dark:text-white text-gray-900 text-[15px]">{item.title}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {item.count !== undefined && (
                                                    <span className="dark:text-[#8696a0] text-gray-500 text-sm">{item.count}</span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Divider */}
                            <div className="h-2 dark:bg-[#0b141a] bg-gray-100" />

                            {/* Analytics Section */}
                            <div className="dark:bg-[#111b21] bg-white">
                                {analyticsItems.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={item.onClick}
                                        className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-100 dark:hover:bg-[#202c33] transition-colors"
                                    >
                                        <div className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center`}>
                                            <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                                        </div>
                                        <div className="flex-1 text-left flex items-center gap-2">
                                            <p className="dark:text-white text-gray-900 text-[15px]">{item.title}</p>
                                            {item.badge && (
                                                <span className={`${item.badgeColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronRight className="w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                    </button>
                                ))}
                            </div>

                            {/* Bottom padding */}
                            <div className="h-12 dark:bg-[#111b21] bg-gray-50" />
                        </div>
                    </motion.div>
                    
                    {/* Delete Confirmation Modal */}
                    <AnimatePresence>
                        {showDeleteConfirm && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="dark:bg-[#233138] bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                                >
                                    <h3 className="dark:text-white text-gray-900 text-xl font-semibold mb-3 text-center">Delete Channel?</h3>
                                    <p className="dark:text-[#8696a0] text-gray-500 text-sm mb-6 text-center">
                                        Are you sure you want to delete this channel? This action cannot be undone.
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={() => {
                                                setShowDeleteConfirm(false);
                                                onDelete?.();
                                            }}
                                            className="w-full py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                                        >
                                            Delete Channel
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="w-full py-3 dark:bg-[#3b4a54] bg-gray-200 dark:text-white text-gray-700 rounded-xl font-medium dark:hover:bg-[#4a5c68] hover:bg-gray-300 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Subscribers List Panel */}
                    <SubscribersList
                        isOpen={showSubscribers}
                        onClose={() => setShowSubscribers(false)}
                        group={group}
                        currentUserId={currentUserId}
                        onMemberRemoved={() => {
                            // Optionally refresh group data
                        }}
                    />

                    {/* Removed Users List Panel */}
                    <RemovedUsersList
                        isOpen={showRemovedUsers}
                        onClose={() => setShowRemovedUsers(false)}
                        group={group}
                        currentUserId={currentUserId}
                        onUserUnbanned={() => {
                            // Optionally refresh group data
                        }}
                    />
                </>
            )}
        </AnimatePresence>
    );
};

export default ChannelEdit;
