import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UserPlus, Loader2, Ban } from "lucide-react";
import { SafeAvatar } from "./SafeImage";
import axios from "axios";

const RemovedUsersList = ({ 
    isOpen, 
    onClose, 
    group,
    currentUserId,
    onUserUnbanned
}) => {
    const [bannedUsers, setBannedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unbanningUser, setUnbanningUser] = useState(null);

    const isCreator = group?.creatorId === currentUserId;
    const isAdmin = group?.admins?.includes(currentUserId);
    const canManageBans = isCreator || isAdmin;

    useEffect(() => {
        if (isOpen && group?.groupId) {
            fetchBannedUsers();
        }
    }, [isOpen, group?.groupId]);

    const fetchBannedUsers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            
            // Get banned user IDs from API
            const bannedRes = await axios.get(`/api/groups/${group.groupId}/banned`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const bannedUserIds = bannedRes.data.bannedUsers || [];
            
            if (bannedUserIds.length === 0) {
                setBannedUsers([]);
                setLoading(false);
                return;
            }
            
            // Fetch user details for each banned user
            const userDetails = await Promise.all(
                bannedUserIds.map(async (userId) => {
                    try {
                        const res = await axios.get(`/api/users/${userId}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const userData = res.data.user || res.data;
                        return {
                            userId: userData.userId || userId,
                            username: userData.username || "Unknown",
                            name: userData.name || userData.username || "Unknown User",
                            avatar: userData.avatar,
                        };
                    } catch (error) {
                        return {
                            userId,
                            username: "Unknown",
                            name: "Unknown User",
                        };
                    }
                })
            );
            
            setBannedUsers(userDetails);
        } catch (error) {
            console.error("Error fetching banned users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnbanUser = async (userId) => {
        setUnbanningUser(userId);
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/groups/${group.groupId}/banned`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { userId }
            });
            
            // Remove from local state
            setBannedUsers(prev => prev.filter(u => u.userId !== userId));
            onUserUnbanned?.();
        } catch (error) {
            console.error("Error unbanning user:", error);
            alert(error.response?.data?.message || "Failed to unban user");
        } finally {
            setUnbanningUser(null);
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
                        className="fixed inset-0 bg-black/50 z-[70] md:pl-72"
                    />

                    {/* Removed Users Panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 w-full md:w-[420px] md:ml-72 bg-[#111b21] z-[70] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="text-[#aebac1] hover:text-white p-1 transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <div className="flex-1">
                                <h2 className="text-white text-lg font-medium">Removed Users</h2>
                                <p className="text-[#8696a0] text-xs">{bannedUsers.length} removed</p>
                            </div>
                        </div>

                        {/* Info Banner */}
                        <div className="bg-[#182229] px-4 py-3 border-b border-[#2a3942]">
                            <p className="text-[#8696a0] text-sm">
                                Removed users cannot rejoin this channel unless you unban them or regenerate the invite link.
                            </p>
                        </div>

                        {/* Banned Users List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
                                </div>
                            ) : bannedUsers.length === 0 ? (
                                <div className="text-center py-12">
                                    <Ban className="w-12 h-12 text-[#8696a0] mx-auto mb-3 opacity-50" />
                                    <p className="text-[#8696a0]">No removed users</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[#2a3942]">
                                    {bannedUsers.map((user) => (
                                        <div
                                            key={user.userId}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] transition-colors"
                                        >
                                            {/* Avatar with Ban Icon */}
                                            <div className="relative">
                                                <SafeAvatar
                                                    src={user.avatar}
                                                    alt={user.username || user.name}
                                                    fallbackText={user.username || user.name}
                                                    className="w-12 h-12 rounded-full object-cover opacity-60"
                                                />
                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-red-500">
                                                    <Ban className="w-3 h-3 text-white" />
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-base font-semibold">
                                                    {user.name || user.username || "Unknown User"}
                                                </p>
                                                {user.name && user.username && user.name !== user.username && (
                                                    <p className="text-[#8696a0] text-sm">
                                                        @{user.username}
                                                    </p>
                                                )}
                                                <span className="text-red-400 text-xs">Removed from channel</span>
                                            </div>

                                            {/* Unban Button */}
                                            {canManageBans && (
                                                <button
                                                    onClick={() => handleUnbanUser(user.userId)}
                                                    disabled={unbanningUser === user.userId}
                                                    className="flex items-center gap-2 px-3 py-2 bg-[#00a884] hover:bg-[#00a884]/80 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {unbanningUser === user.userId ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <UserPlus className="w-4 h-4" />
                                                    )}
                                                    <span>Unban</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default RemovedUsersList;
