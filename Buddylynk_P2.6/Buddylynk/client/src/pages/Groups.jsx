import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useRealTimeGroups } from "../hooks/useRealTimeGroups";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, X, Image as ImageIcon, Loader2, Search, Lock, Globe } from "lucide-react";
import { SafeImage } from "../components/SafeImage";
import axios from "axios";

const Groups = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroup, setNewGroup] = useState({ name: "", description: "", type: "group", visibility: "public" });
    const [coverImage, setCoverImage] = useState(null);
    const [coverImagePreview, setCoverImagePreview] = useState(null);
    const [creating, setCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("joined"); // "joined" or "discover"

    useEffect(() => {
        fetchGroups();
    }, []);

    useRealTimeGroups(setGroups);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("/api/groups", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGroups(res.data);
        } catch (error) {
            console.error("Error fetching groups:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        
        if (!newGroup.name || !newGroup.name.trim()) {
            alert("Please enter a group name");
            return;
        }
        
        if (!newGroup.description || !newGroup.description.trim()) {
            alert("Please enter a description");
            return;
        }
        
        setCreating(true);
        
        try {
            const token = localStorage.getItem("token");
            
            if (!token) {
                alert("Please login to create a group");
                setCreating(false);
                return;
            }
            
            const formData = new FormData();
            formData.append("name", newGroup.name.trim());
            formData.append("description", newGroup.description.trim());
            formData.append("type", newGroup.type);
            formData.append("visibility", newGroup.visibility);
            
            if (coverImage) {
                formData.append("coverImage", coverImage);
            }
            
            const response = await axios.post("/api/groups", formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data"
                }
            });

            // If private channel, show invite link
            if (response.data.visibility === 'private' && response.data.inviteCode) {
                const inviteUrl = `${window.location.origin}/invite/${response.data.inviteCode}`;
                alert(`Private ${newGroup.type} created!\n\nShare this invite link:\n${inviteUrl}`);
            }
            
            setShowCreateModal(false);
            setNewGroup({ name: "", description: "", type: "group", visibility: "public" });
            setCoverImage(null);
            setCoverImagePreview(null);
            fetchGroups();
        } catch (error) {
            console.error("Error creating group:", error);
            alert(error.response?.data?.message || "Failed to create group. Please try again.");
        } finally {
            setCreating(false);
        }
    };

    const handleJoinGroup = async (groupId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/groups/${groupId}/join`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchGroups();
        } catch (error) {
            console.error("Error joining group:", error);
            // Show error message to user (especially for banned users)
            alert(error.response?.data?.message || "Failed to join group");
        }
    };

    const handleLeaveGroup = async (groupId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/groups/${groupId}/leave`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchGroups();
        } catch (error) {
            console.error("Error leaving group:", error);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCoverImage(file);
            setCoverImagePreview(URL.createObjectURL(file));
        }
    };

    // Filter groups based on search and active tab
    const filteredGroups = groups.filter(group => {
        const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchesSearch) return false;
        
        const isMember = group.members?.includes(user.userId);
        
        if (activeTab === "joined") {
            // Show only groups user has joined (public or private)
            return isMember;
        } else {
            // Discover: Show only public groups user hasn't joined
            return !isMember && group.visibility !== 'private';
        }
    });
    
    // Count for tabs
    const joinedCount = groups.filter(g => g.members?.includes(user.userId)).length;
    const discoverCount = groups.filter(g => !g.members?.includes(user.userId) && g.visibility !== 'private').length;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { type: "spring", stiffness: 300, damping: 25 }
        }
    };

    return (
        <div className="min-h-screen md:pl-72 pt-4 pb-24 md:pb-4 md:pr-4 dark:bg-dark bg-gray-100">
            <div className="max-w-6xl mx-auto px-3 sm:px-4">
                {/* Header */}
                <motion.div 
                    className="flex flex-col gap-4 mb-6 sm:mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <motion.div
                                className="p-2.5 sm:p-3 rounded-xl bg-primary/20"
                                whileHover={{ rotate: 10, scale: 1.1 }}
                            >
                                <Users className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                            </motion.div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold dark:text-white text-gray-900">Groups</h1>
                                <p className="text-theme-secondary text-xs sm:text-sm">{groups.length} groups available</p>
                            </div>
                        </div>
                        
                        <motion.button
                            onClick={() => setShowCreateModal(true)}
                            className="btn-primary flex items-center gap-2 py-2.5 px-4 sm:px-6"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden xs:inline">Create</span>
                        </motion.button>
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex gap-2 bg-gray-200 dark:bg-[#202c33] p-1.5 rounded-2xl border border-gray-300 dark:border-[#2a3942]">
                        <button
                            onClick={() => setActiveTab("joined")}
                            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                                activeTab === "joined"
                                    ? "bg-primary text-white shadow-lg"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
                            }`}
                        >
                            Joined ({joinedCount})
                        </button>
                        <button
                            onClick={() => setActiveTab("discover")}
                            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                                activeTab === "discover"
                                    ? "bg-primary text-white shadow-lg"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
                            }`}
                        >
                            Discover ({discoverCount})
                        </button>
                    </div>
                    
                    {/* Search */}
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-secondary" />
                        <input
                            type="text"
                            placeholder={activeTab === "joined" ? "Search your groups..." : "Discover new groups..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field pl-10 w-full"
                        />
                    </div>
                </motion.div>

                {/* Groups Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="glass-panel overflow-hidden">
                                <div className="h-32 skeleton" />
                                <div className="p-4 space-y-3">
                                    <div className="h-6 skeleton rounded w-3/4" />
                                    <div className="h-4 skeleton rounded w-full" />
                                    <div className="h-4 skeleton rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel p-12 text-center"
                    >
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            <Users className="w-20 h-20 text-theme-muted mx-auto mb-4" />
                        </motion.div>
                        <h2 className="text-2xl font-semibold dark:text-white text-gray-900 mb-2">
                            {searchQuery 
                                ? "No groups found" 
                                : activeTab === "joined" 
                                    ? "No joined groups yet" 
                                    : "No groups to discover"}
                        </h2>
                        <p className="text-theme-secondary mb-6">
                            {searchQuery 
                                ? "Try a different search term" 
                                : activeTab === "joined"
                                    ? "Join some groups from the Discover tab!"
                                    : "All public groups have been joined!"}
                        </p>
                        {!searchQuery && (
                            <motion.button
                                onClick={() => activeTab === "joined" ? setActiveTab("discover") : setShowCreateModal(true)}
                                className="btn-primary"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {activeTab === "joined" ? "Discover Groups" : "Create New Group"}
                            </motion.button>
                        )}
                    </motion.div>
                ) : (
                    <motion.div 
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {filteredGroups.map((group) => {
                            const isMember = group.members?.includes(user.userId);
                            
                            return (
                                <motion.div
                                    key={group.groupId}
                                    variants={itemVariants}
                                    className="glass-panel overflow-hidden cursor-pointer group"
                                    onClick={() => navigate(`/groups/${group.groupId}`)}
                                    whileHover={{ y: -5, scale: 1.02 }}
                                    transition={{ type: "spring", stiffness: 300 }}
                                >
                                    {/* Cover Image */}
                                    <div className="h-32 bg-gradient-to-br from-primary/20 to-secondary/20 relative overflow-hidden">
                                        {group.coverImage ? (
                                            <SafeImage
                                                src={group.coverImage}
                                                alt={group.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Users className="w-16 h-16 text-primary/30" />
                                            </div>
                                        )}
                                        
                                        {/* Type Badge */}
                                        <div className="absolute top-3 left-3 flex gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                group.type === 'channel' 
                                                    ? 'bg-blue-500/90 text-white' 
                                                    : 'bg-purple-500/90 text-white'
                                            }`}>
                                                {group.type === 'channel' ? 'Channel' : 'Group'}
                                            </span>
                                            {group.visibility === 'private' && (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-800/90 text-white flex items-center gap-1">
                                                    <Lock className="w-3 h-3" />
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Member Badge */}
                                        {isMember && (
                                            <div className="absolute top-3 right-3 badge-success">
                                                Member
                                            </div>
                                        )}
                                    </div>

                                    {/* Group Info */}
                                    <div className="p-4">
                                        <h3 className="font-bold text-lg dark:text-white text-gray-900 mb-2 truncate group-hover:text-primary transition-colors">
                                            {group.name}
                                        </h3>
                                        <p className="text-sm text-theme-secondary mb-4 line-clamp-2">
                                            {group.description || "No description"}
                                        </p>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm text-theme-secondary">
                                                <Users className="w-4 h-4" />
                                                <span>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</span>
                                            </div>
                                            
                                            <motion.button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    isMember ? handleLeaveGroup(group.groupId) : handleJoinGroup(group.groupId);
                                                }}
                                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                                    isMember
                                                        ? 'btn-secondary'
                                                        : 'btn-primary'
                                                }`}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                {isMember ? 'Leave' : 'Join'}
                                            </motion.button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Create Group Modal */}
                <AnimatePresence>
                    {showCreateModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => setShowCreateModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                onClick={(e) => e.stopPropagation()}
                                className="glass-panel max-w-md w-full p-6 border border-white/20 max-h-[90vh] overflow-y-auto"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold dark:text-white text-gray-900">
                                        Create {newGroup.type === 'channel' ? 'Channel' : 'Group'}
                                    </h2>
                                    <motion.button
                                        onClick={() => setShowCreateModal(false)}
                                        className="btn-icon"
                                        whileHover={{ rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <X className="w-6 h-6" />
                                    </motion.button>
                                </div>

                                <form onSubmit={handleCreateGroup} className="space-y-5">
                                    {/* Type Selector */}
                                    <div>
                                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                                            Type
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setNewGroup({ ...newGroup, type: "group" })}
                                                className={`p-3 rounded-xl border-2 transition-all ${
                                                    newGroup.type === "group"
                                                        ? 'border-purple-500 bg-purple-500/10 dark:bg-purple-500/20'
                                                        : 'dark:border-white/20 border-gray-300 hover:border-purple-500/50'
                                                }`}
                                            >
                                                <div className="text-center">
                                                    <Users className="w-6 h-6 mx-auto mb-1 text-purple-500" />
                                                    <span className="text-sm font-medium dark:text-white text-gray-900">Group</span>
                                                    <p className="text-xs text-theme-secondary mt-1">Everyone can post</p>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewGroup({ ...newGroup, type: "channel" })}
                                                className={`p-3 rounded-xl border-2 transition-all ${
                                                    newGroup.type === "channel"
                                                        ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20'
                                                        : 'dark:border-white/20 border-gray-300 hover:border-blue-500/50'
                                                }`}
                                            >
                                                <div className="text-center">
                                                    <Users className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                                                    <span className="text-sm font-medium dark:text-white text-gray-900">Channel</span>
                                                    <p className="text-xs text-theme-secondary mt-1">Only admins post</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Visibility Selector */}
                                    <div>
                                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                                            Visibility
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setNewGroup({ ...newGroup, visibility: "public" })}
                                                className={`p-3 rounded-xl border-2 transition-all ${
                                                    newGroup.visibility === "public"
                                                        ? 'border-green-500 bg-green-500/10 dark:bg-green-500/20'
                                                        : 'dark:border-white/20 border-gray-300 hover:border-green-500/50'
                                                }`}
                                            >
                                                <div className="text-center">
                                                    <Globe className="w-6 h-6 mx-auto mb-1 text-green-500" />
                                                    <span className="text-sm font-medium dark:text-white text-gray-900">Public</span>
                                                    <p className="text-xs text-theme-secondary mt-1">Anyone can find</p>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewGroup({ ...newGroup, visibility: "private" })}
                                                className={`p-3 rounded-xl border-2 transition-all ${
                                                    newGroup.visibility === "private"
                                                        ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/20'
                                                        : 'dark:border-white/20 border-gray-300 hover:border-orange-500/50'
                                                }`}
                                            >
                                                <div className="text-center">
                                                    <Lock className="w-6 h-6 mx-auto mb-1 text-orange-500" />
                                                    <span className="text-sm font-medium dark:text-white text-gray-900">Private</span>
                                                    <p className="text-xs text-theme-secondary mt-1">Invite link only</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Cover Image Upload */}
                                    <div>
                                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                                            Cover Image
                                        </label>
                                        <div className="relative">
                                            {coverImagePreview ? (
                                                <div className="relative h-32 rounded-xl overflow-hidden">
                                                    <img
                                                        src={coverImagePreview}
                                                        alt="Preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <motion.button
                                                        type="button"
                                                        onClick={() => {
                                                            setCoverImage(null);
                                                            setCoverImagePreview(null);
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full"
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </motion.button>
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed dark:border-white/20 border-gray-300 rounded-xl cursor-pointer hover:border-primary dark:hover:border-primary transition-colors group">
                                                    <ImageIcon className="w-8 h-8 text-theme-secondary group-hover:text-primary transition-colors mb-2" />
                                                    <span className="text-sm text-theme-secondary group-hover:text-primary transition-colors">
                                                        Click to upload
                                                    </span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageChange}
                                                        className="hidden"
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                                            {newGroup.type === 'channel' ? 'Channel' : 'Group'} Name
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="input-field"
                                            value={newGroup.name}
                                            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                                            placeholder={`Enter ${newGroup.type === 'channel' ? 'channel' : 'group'} name`}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            required
                                            className="input-field resize-none"
                                            rows="3"
                                            value={newGroup.description}
                                            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                                            placeholder="What's this group about?"
                                        />
                                    </div>

                                    <motion.button 
                                        type="submit" 
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                        disabled={creating}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {creating ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-5 h-5" />
                                                Create {newGroup.visibility === 'private' ? 'Private ' : ''}{newGroup.type === 'channel' ? 'Channel' : 'Group'}
                                            </>
                                        )}
                                    </motion.button>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Groups;
