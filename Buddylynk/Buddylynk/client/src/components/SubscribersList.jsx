import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MoreVertical, Shield, UserMinus, Loader2, Crown, User } from "lucide-react";
import { SafeAvatar } from "./SafeImage";
import axios from "axios";

const SubscribersList = ({ 
    isOpen, 
    onClose, 
    group,
    currentUserId,
    onMemberRemoved
}) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showMemberMenu, setShowMemberMenu] = useState(null);
    const [removingMember, setRemovingMember] = useState(null);

    const isCreator = group?.creatorId === currentUserId;
    const isAdmin = group?.admins?.includes(currentUserId);
    const canManageMembers = isCreator || isAdmin;

    useEffect(() => {
        if (isOpen && group?.groupId) {
            fetchMembers();
        }
    }, [isOpen, group?.groupId]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            
            // Get member IDs from group
            const memberIds = group?.members || [];
            
            // Fetch user details for each member
            const memberDetails = await Promise.all(
                memberIds.map(async (userId) => {
                    try {
                        const res = await axios.get(`/api/users/${userId}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        // API returns { user: {...}, posts: [...] }
                        const userData = res.data.user || res.data;
                        return {
                            userId: userData.userId || userId,
                            username: userData.username || "Unknown",
                            name: userData.name || userData.username || "Unknown User",
                            avatar: userData.avatar,
                            bio: userData.bio,
                            isCreator: userId === group?.creatorId,
                            isAdmin: group?.admins?.includes(userId)
                        };
                    } catch (error) {
                        return {
                            userId,
                            username: "Unknown",
                            name: "Unknown User",
                            isCreator: userId === group?.creatorId,
                            isAdmin: group?.admins?.includes(userId)
                        };
                    }
                })
            );
            
            // Sort: Creator first, then admins, then regular members
            memberDetails.sort((a, b) => {
                if (a.isCreator) return -1;
                if (b.isCreator) return 1;
                if (a.isAdmin && !b.isAdmin) return -1;
                if (!a.isAdmin && b.isAdmin) return 1;
                return 0;
            });
            
            setMembers(memberDetails);
        } catch (error) {
            console.error("Error fetching members:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        setRemovingMember(userId);
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/groups/${group.groupId}/members`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { userId }
            });
            
            // Remove from local state
            setMembers(prev => prev.filter(m => m.userId !== userId));
            setShowMemberMenu(null);
            onMemberRemoved?.();
        } catch (error) {
            console.error("Error removing member:", error);
            alert(error.response?.data?.message || "Failed to remove member");
        } finally {
            setRemovingMember(null);
        }
    };

    const handleMakeAdmin = async (userId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/groups/${group.groupId}/admins`, 
                { userId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Update local state
            setMembers(prev => prev.map(m => 
                m.userId === userId ? { ...m, isAdmin: true } : m
            ));
            setShowMemberMenu(null);
        } catch (error) {
            console.error("Error making admin:", error);
            alert(error.response?.data?.message || "Failed to make admin");
        }
    };

    const handleRemoveAdmin = async (userId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/groups/${group.groupId}/admins`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { userId }
            });
            
            // Update local state
            setMembers(prev => prev.map(m => 
                m.userId === userId ? { ...m, isAdmin: false } : m
            ));
            setShowMemberMenu(null);
        } catch (error) {
            console.error("Error removing admin:", error);
            alert(error.response?.data?.message || "Failed to remove admin");
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

                    {/* Subscribers Panel */}
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
                                <h2 className="text-white text-lg font-medium">Subscribers</h2>
                                <p className="text-[#8696a0] text-xs">{members.length} subscribers</p>
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
                                </div>
                            ) : members.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-[#8696a0]">No subscribers yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[#2a3942]">
                                    {members.map((member) => (
                                        <div
                                            key={member.userId}
                                            className="flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] transition-colors"
                                        >
                                            {/* Avatar with Role Icon */}
                                            <div className="relative">
                                                <SafeAvatar
                                                    src={member.avatar}
                                                    alt={member.username || member.name}
                                                    fallbackText={member.username || member.name}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                                {/* Role Badge Icon */}
                                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                                                    member.isCreator 
                                                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500' 
                                                        : member.isAdmin 
                                                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500' 
                                                            : 'bg-gradient-to-r from-gray-500 to-gray-600'
                                                }`}>
                                                    {member.isCreator ? (
                                                        <Crown className="w-3 h-3 text-white" />
                                                    ) : member.isAdmin ? (
                                                        <Shield className="w-3 h-3 text-white" />
                                                    ) : (
                                                        <User className="w-3 h-3 text-white" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {/* Name - More visible */}
                                                    <p className="text-white text-base font-semibold">
                                                        {member.name || member.username || "Unknown User"}
                                                    </p>
                                                    {/* Role Badge */}
                                                    {member.isCreator && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 text-[10px] font-bold rounded-full border border-yellow-500/30">
                                                            <Crown className="w-3 h-3" />
                                                            CREATOR
                                                        </span>
                                                    )}
                                                    {member.isAdmin && !member.isCreator && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-400 text-[10px] font-bold rounded-full border border-blue-500/30">
                                                            <Shield className="w-3 h-3" />
                                                            ADMIN
                                                        </span>
                                                    )}
                                                    {!member.isCreator && !member.isAdmin && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] font-bold rounded-full border border-gray-500/30">
                                                            <User className="w-3 h-3" />
                                                            SUBSCRIBER
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Username if different from name */}
                                                {member.name && member.username && member.name !== member.username && (
                                                    <p className="text-[#00a884] text-sm">
                                                        @{member.username}
                                                    </p>
                                                )}
                                                {member.bio && (
                                                    <p className="text-[#8696a0] text-sm truncate mt-0.5">
                                                        {member.bio}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions Menu - Only for creator/admins, not for self or creator */}
                                            {canManageMembers && member.userId !== currentUserId && !member.isCreator && (
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setShowMemberMenu(
                                                            showMemberMenu === member.userId ? null : member.userId
                                                        )}
                                                        className="p-2 text-[#8696a0] hover:text-white rounded-full hover:bg-[#2a3942] transition-colors"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {/* Dropdown Menu */}
                                                    {showMemberMenu === member.userId && (
                                                        <>
                                                            <div 
                                                                className="fixed inset-0 z-[80]"
                                                                onClick={() => setShowMemberMenu(null)}
                                                            />
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-[#233138] rounded-lg shadow-xl border border-[#2a3942] z-[81] overflow-hidden">
                                                                {isCreator && (
                                                                    <>
                                                                        {member.isAdmin ? (
                                                                            <button
                                                                                onClick={() => handleRemoveAdmin(member.userId)}
                                                                                className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#2a3942] transition-colors"
                                                                            >
                                                                                <Shield className="w-5 h-5 text-[#8696a0]" />
                                                                                <span>Remove Admin</span>
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => handleMakeAdmin(member.userId)}
                                                                                className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#2a3942] transition-colors"
                                                                            >
                                                                                <Shield className="w-5 h-5 text-[#5865f2]" />
                                                                                <span>Make Admin</span>
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => handleRemoveMember(member.userId)}
                                                                    disabled={removingMember === member.userId}
                                                                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-[#2a3942] transition-colors disabled:opacity-50"
                                                                >
                                                                    {removingMember === member.userId ? (
                                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                                    ) : (
                                                                        <UserMinus className="w-5 h-5" />
                                                                    )}
                                                                    <span>Remove from Channel</span>
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
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

export default SubscribersList;
