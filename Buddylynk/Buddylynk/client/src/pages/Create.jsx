import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users,
    Radio,
    X,
    Upload,
    Lock,
    Globe,
    Edit3,
    Loader2,
    Search,
    Check,
    Crown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRealTimeGroups } from "../hooks/useRealTimeGroups";
import { SafeImage } from "../components/SafeImage";
import HamsterLoader from "../components/HamsterLoader";
import { containerVariants, itemVariants, scaleVariants, fastTransition } from "../utils/animations";
import axios from "axios";

const Create = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Groups list state
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("joined"); // "joined" or "discover"

    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showChannelModal, setShowChannelModal] = useState(false);
    const [showFabOptions, setShowFabOptions] = useState(false);
    const [creating, setCreating] = useState(false);

    // Group form state
    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [groupImage, setGroupImage] = useState(null);
    const [groupImagePreview, setGroupImagePreview] = useState(null);

    // Channel form state
    const [channelName, setChannelName] = useState("");
    const [channelDescription, setChannelDescription] = useState("");
    const [channelImage, setChannelImage] = useState(null);
    const [channelImagePreview, setChannelImagePreview] = useState(null);
    const [channelPrivacy, setChannelPrivacy] = useState("public");

    useEffect(() => {
        fetchGroups();
    }, []);

    useRealTimeGroups(setGroups);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("/api/groups", {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setGroups(res.data);
        } catch (error) {
            console.error("Error fetching groups:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGroupImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setGroupImage(file);
            setGroupImagePreview(URL.createObjectURL(file));
        }
    };

    const handleChannelImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setChannelImage(file);
            setChannelImagePreview(URL.createObjectURL(file));
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            alert("Please enter a group name");
            return;
        }
        setCreating(true);
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("name", groupName.trim());
            formData.append("description", groupDescription.trim());
            if (groupImage) formData.append("coverImage", groupImage);

            await axios.post("/api/groups", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            resetGroupForm();
            setShowGroupModal(false);
            fetchGroups();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to create group");
        } finally {
            setCreating(false);
        }
    };

    const handleCreateChannel = async () => {
        if (!channelName.trim()) {
            alert("Please enter a channel name");
            return;
        }
        setCreating(true);
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("name", channelName.trim());
            formData.append("description", channelDescription.trim());
            formData.append("type", "channel");
            formData.append("visibility", channelPrivacy);
            if (channelImage) formData.append("coverImage", channelImage);

            await axios.post("/api/groups", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            resetChannelForm();
            setShowChannelModal(false);
            fetchGroups();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to create channel");
        } finally {
            setCreating(false);
        }
    };

    const resetGroupForm = () => {
        setGroupName("");
        setGroupDescription("");
        setGroupImage(null);
        setGroupImagePreview(null);
    };

    const resetChannelForm = () => {
        setChannelName("");
        setChannelDescription("");
        setChannelImage(null);
        setChannelImagePreview(null);
        setChannelPrivacy("public");
    };

    // Filter groups based on search and active tab
    const filteredGroups = groups.filter((group) => {
        // Handle search - if no search query, match all
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query || 
            (group.name || '').toLowerCase().includes(query) ||
            (group.description || '').toLowerCase().includes(query);
        
        if (!matchesSearch) return false;
        
        const userId = user?.userId;
        const isMember = userId ? group.members?.includes(userId) : false;
        
        if (activeTab === "joined") {
            // Show only groups user has joined (public or private)
            return isMember;
        } else {
            // Discover: Show only public groups user hasn't joined
            return !isMember && group.visibility !== 'private';
        }
    });
    
    // Count for tabs
    const userId = user?.userId;
    const joinedCount = groups.filter(g => userId ? g.members?.includes(userId) : false).length;
    const discoverCount = groups.filter(g => {
        const isMember = userId ? g.members?.includes(userId) : false;
        return !isMember && g.visibility !== 'private';
    }).length;

    // Get last message preview for Telegram style
    const getLastMessage = (group) => {
        if (group.posts && group.posts.length > 0) {
            const lastPost = group.posts[0];
            return lastPost.content?.substring(0, 50) || "Media";
        }
        return "No messages yet";
    };

    const getLastMessageTime = (group) => {
        if (group.posts && group.posts.length > 0) {
            const date = new Date(group.posts[0].createdAt);
            const now = new Date();
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
                return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            } else if (diffDays < 7) {
                return date.toLocaleDateString([], { weekday: "short" });
            }
            return date.toLocaleDateString([], { month: "short", day: "numeric" });
        }
        return "";
    };

    return (
        <div className="fixed inset-0 md:pl-72 dark:bg-[#111b21] bg-gray-50 flex flex-col">
            {/* Telegram-style Header */}
            <div className="dark:bg-[#202c33] bg-white px-4 py-3 flex items-center gap-3 border-b dark:border-[#2a3942] border-gray-200">
                <h1 className="text-xl font-semibold dark:text-white text-gray-900 flex-1">Channels</h1>
                <div className="dark:text-[#8696a0] text-gray-600 text-sm">{filteredGroups.length}</div>
            </div>

            {/* Tabs */}
            <div className="dark:bg-[#111b21] bg-gray-50 px-3 pt-3 pb-2">
                <div className="flex gap-2 dark:bg-[#202c33] bg-gray-200 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab("joined")}
                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                            activeTab === "joined"
                                ? "bg-[#00a884] text-white"
                                : "dark:text-[#8696a0] text-gray-600 dark:hover:text-white hover:text-gray-900 dark:hover:bg-[#2a3942] hover:bg-gray-300"
                        }`}
                    >
                        Joined ({joinedCount})
                    </button>
                    <button
                        onClick={() => setActiveTab("discover")}
                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                            activeTab === "discover"
                                ? "bg-[#00a884] text-white"
                                : "dark:text-[#8696a0] text-gray-600 dark:hover:text-white hover:text-gray-900 dark:hover:bg-[#2a3942] hover:bg-gray-300"
                        }`}
                    >
                        Discover ({discoverCount})
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="dark:bg-[#111b21] bg-gray-50 px-3 py-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                    <input
                        type="text"
                        placeholder={activeTab === "joined" ? "Search your channels..." : "Discover new channels..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 dark:bg-[#202c33] bg-white dark:text-white text-gray-900 dark:placeholder-[#8696a0] placeholder-gray-400 rounded-lg focus:outline-none text-sm border dark:border-transparent border-gray-300"
                    />
                </div>
            </div>

            {/* Channel List - Telegram Style */}
            <div className="flex-1 overflow-y-auto pb-24">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <HamsterLoader size="medium" text="Loading channels..." />
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4">
                        <Users className="w-16 h-16 dark:text-[#8696a0] text-gray-400 mb-4" />
                        <p className="dark:text-[#8696a0] text-gray-600 text-center">
                            {searchQuery 
                                ? "No channels found" 
                                : activeTab === "joined" 
                                    ? "No joined channels yet" 
                                    : "No channels to discover"}
                        </p>
                        <p className="dark:text-[#8696a0] text-gray-500 text-sm text-center mt-1">
                            {activeTab === "joined" 
                                ? "Switch to Discover to find channels" 
                                : "Tap the pencil button to create one"}
                        </p>
                        {activeTab === "joined" && !searchQuery && (
                            <button
                                onClick={() => setActiveTab("discover")}
                                className="mt-4 px-6 py-2 bg-[#00a884] text-white rounded-lg font-medium"
                            >
                                Discover Channels
                            </button>
                        )}
                    </div>
                ) : (
                    <motion.div 
                        key={activeTab}
                        className="divide-y dark:divide-[#2a3942] divide-gray-200"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {filteredGroups.map((group) => (
                            <motion.div
                                key={group.groupId}
                                variants={itemVariants}
                                onClick={() => navigate(`/groups/${group.groupId}`)}
                                className="flex items-center gap-3 px-4 py-3 dark:hover:bg-[#202c33] hover:bg-gray-100 cursor-pointer transition-colors duration-100 dark:active:bg-[#2a3942] active:bg-gray-200 transform-gpu"
                            >
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 dark:bg-[#2a3942] bg-gray-200">
                                    {group.coverImage ? (
                                        <SafeImage
                                            src={group.coverImage}
                                            alt={group.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#00a884] to-[#25d366]">
                                            <Users className="w-6 h-6 text-white" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h3 className="dark:text-white text-gray-900 font-medium truncate">
                                                {group.name}
                                            </h3>
                                            {/* Channel/Group badge */}
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                                                group.type === "channel" 
                                                    ? "bg-purple-500/20 text-purple-400" 
                                                    : "bg-blue-500/20 text-blue-400"
                                            }`}>
                                                {group.type === "channel" ? "Channel" : "Group"}
                                            </span>
                                            {/* Private badge */}
                                            {group.visibility === "private" && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 bg-orange-500/20 text-orange-400 flex items-center gap-0.5">
                                                    <Lock className="w-2.5 h-2.5" />
                                                    Private
                                                </span>
                                            )}
                                        </div>
                                        {/* Creator badge - shows if user created this channel */}
                                        {group.creatorId === user?.userId && (
                                            <span className="flex-shrink-0 ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-500 flex items-center gap-0.5">
                                                <Crown className="w-3 h-3" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <p className="dark:text-[#8696a0] text-gray-600 text-sm truncate">
                                            {getLastMessage(group)}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Floating Action Button - Telegram Blue Pencil */}
            <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40">
                <AnimatePresence>
                    {showFabOptions && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowFabOptions(false)}
                                className="fixed inset-0 bg-black/40 -z-10"
                            />
                            <div className="absolute bottom-20 right-0 space-y-3 min-w-[260px]">
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    transition={fastTransition}
                                    onClick={() => {
                                        setShowChannelModal(true);
                                        setShowFabOptions(false);
                                    }}
                                    className="w-full dark:bg-[#202c33] bg-white rounded-2xl p-4 flex items-center gap-4 dark:hover:bg-[#2a3942] hover:bg-gray-100 transition-colors duration-150 shadow-lg transform-gpu"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                        <Radio className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="dark:text-white text-gray-900 font-medium">New Channel</h4>
                                        <p className="dark:text-[#8696a0] text-gray-600 text-xs">Broadcast to subscribers</p>
                                    </div>
                                </motion.button>
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    transition={{ ...fastTransition, delay: 0.03 }}
                                    onClick={() => {
                                        setShowGroupModal(true);
                                        setShowFabOptions(false);
                                    }}
                                    className="w-full dark:bg-[#202c33] bg-white rounded-2xl p-4 flex items-center gap-4 dark:hover:bg-[#2a3942] hover:bg-gray-100 transition-colors duration-150 shadow-lg transform-gpu"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="dark:text-white text-gray-900 font-medium">New Group</h4>
                                        <p className="dark:text-[#8696a0] text-gray-600 text-xs">Chat with friends</p>
                                    </div>
                                </motion.button>
                            </div>
                        </>
                    )}
                </AnimatePresence>

                {/* Main FAB - Blue Pencil */}
                <motion.button
                    onClick={() => setShowFabOptions(!showFabOptions)}
                    className="w-14 h-14 rounded-full bg-[#00a884] shadow-lg flex items-center justify-center text-white transform-gpu"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    animate={{ rotate: showFabOptions ? 45 : 0 }}
                    transition={fastTransition}
                >
                    {showFabOptions ? (
                        <X className="w-6 h-6" />
                    ) : (
                        <Edit3 className="w-6 h-6" />
                    )}
                </motion.button>
            </div>

            {/* Create Group Modal */}
            <AnimatePresence>
                {showGroupModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowGroupModal(false)}
                    >
                        <motion.div
                            variants={scaleVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            onClick={(e) => e.stopPropagation()}
                            className="dark:bg-[#202c33] bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transform-gpu"
                        >
                            <div className="px-4 py-3 border-b dark:border-[#2a3942] border-gray-200 flex items-center justify-between">
                                <h2 className="text-xl font-semibold dark:text-white text-gray-900">New Group</h2>
                                <button onClick={() => setShowGroupModal(false)} className="dark:text-[#8696a0] text-gray-500 p-1">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex justify-center">
                                    <label className="cursor-pointer">
                                        <div className="w-20 h-20 rounded-full bg-[#00a884] flex items-center justify-center overflow-hidden">
                                            {groupImagePreview ? (
                                                <img src={groupImagePreview} alt="Group" className="w-full h-full object-cover" />
                                            ) : (
                                                <Upload className="w-8 h-8 text-white" />
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" onChange={handleGroupImageChange} className="hidden" />
                                    </label>
                                </div>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Group name"
                                    className="w-full px-4 py-3 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 dark:placeholder-[#8696a0] placeholder-gray-500 rounded-lg focus:outline-none border dark:border-transparent border-gray-300"
                                />
                                <textarea
                                    value={groupDescription}
                                    onChange={(e) => setGroupDescription(e.target.value)}
                                    placeholder="Description (optional)"
                                    rows={3}
                                    className="w-full px-4 py-3 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 dark:placeholder-[#8696a0] placeholder-gray-500 rounded-lg focus:outline-none resize-none border dark:border-transparent border-gray-300"
                                />
                            </div>
                            <div className="px-4 py-3 border-t dark:border-[#2a3942] border-gray-200 flex gap-3">
                                <button
                                    onClick={() => { resetGroupForm(); setShowGroupModal(false); }}
                                    className="flex-1 py-3 dark:bg-[#2a3942] bg-gray-200 dark:text-white text-gray-900 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={!groupName.trim() || creating}
                                    className="flex-1 py-3 bg-[#00a884] text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    {creating ? "Creating..." : "Create"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Channel Modal */}
            <AnimatePresence>
                {showChannelModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowChannelModal(false)}
                    >
                        <motion.div
                            variants={scaleVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            onClick={(e) => e.stopPropagation()}
                            className="dark:bg-[#202c33] bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transform-gpu"
                        >
                            <div className="px-4 py-3 border-b dark:border-[#2a3942] border-gray-200 flex items-center justify-between">
                                <h2 className="text-xl font-semibold dark:text-white text-gray-900">New Channel</h2>
                                <button onClick={() => setShowChannelModal(false)} className="dark:text-[#8696a0] text-gray-500 p-1">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex justify-center">
                                    <label className="cursor-pointer">
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                                            {channelImagePreview ? (
                                                <img src={channelImagePreview} alt="Channel" className="w-full h-full object-cover" />
                                            ) : (
                                                <Upload className="w-8 h-8 text-white" />
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" onChange={handleChannelImageChange} className="hidden" />
                                    </label>
                                </div>
                                <input
                                    type="text"
                                    value={channelName}
                                    onChange={(e) => setChannelName(e.target.value)}
                                    placeholder="Channel name"
                                    className="w-full px-4 py-3 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 dark:placeholder-[#8696a0] placeholder-gray-500 rounded-lg focus:outline-none border dark:border-transparent border-gray-300"
                                />
                                <textarea
                                    value={channelDescription}
                                    onChange={(e) => setChannelDescription(e.target.value)}
                                    placeholder="Description (optional)"
                                    rows={3}
                                    className="w-full px-4 py-3 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 dark:placeholder-[#8696a0] placeholder-gray-500 rounded-lg focus:outline-none resize-none border dark:border-transparent border-gray-300"
                                />
                                <div className="space-y-2">
                                    <p className="dark:text-[#8696a0] text-gray-600 text-sm">Channel type</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setChannelPrivacy("public")}
                                            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 ${
                                                channelPrivacy === "public" ? "bg-[#00a884] text-white" : "dark:bg-[#2a3942] bg-gray-200 dark:text-[#8696a0] text-gray-600"
                                            }`}
                                        >
                                            <Globe className="w-4 h-4" /> Public
                                        </button>
                                        <button
                                            onClick={() => setChannelPrivacy("private")}
                                            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 ${
                                                channelPrivacy === "private" ? "bg-[#00a884] text-white" : "dark:bg-[#2a3942] bg-gray-200 dark:text-[#8696a0] text-gray-600"
                                            }`}
                                        >
                                            <Lock className="w-4 h-4" /> Private
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="px-4 py-3 border-t dark:border-[#2a3942] border-gray-200 flex gap-3">
                                <button
                                    onClick={() => { resetChannelForm(); setShowChannelModal(false); }}
                                    className="flex-1 py-3 dark:bg-[#2a3942] bg-gray-200 dark:text-white text-gray-900 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateChannel}
                                    disabled={!channelName.trim() || creating}
                                    className="flex-1 py-3 bg-[#00a884] text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    {creating ? "Creating..." : "Create"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Create;
