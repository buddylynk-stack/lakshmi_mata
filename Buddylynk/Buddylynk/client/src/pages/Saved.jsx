import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { motion } from "framer-motion";
import { Bookmark, Heart, MessageCircle, Play, X, BookmarkX, Clock, Trash2 } from "lucide-react";
import { SafeAvatar, SafeImage } from "../components/SafeImage";
import HamsterLoader from "../components/HamsterLoader";
import ConfirmModal from "../components/ConfirmModal";
import axios from "axios";

const Saved = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { socket, on, off } = useSocket();
    const [savedPosts, setSavedPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userAvatars, setUserAvatars] = useState({});
    const [viewMode, setViewMode] = useState("list");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [postToDelete, setPostToDelete] = useState(null);

    useEffect(() => {
        fetchSavedPosts();
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handlePostUpdated = (updatedPost) => {
            setSavedPosts(prevPosts =>
                prevPosts.map(post =>
                    post.postId === updatedPost.postId ? updatedPost : post
                )
            );
        };

        const handlePostDeleted = (deletedPostId) => {
            setSavedPosts(prevPosts =>
                prevPosts.filter(post => post.postId !== deletedPostId)
            );
        };

        on("postUpdated", handlePostUpdated);
        on("postDeleted", handlePostDeleted);

        return () => {
            off("postUpdated", handlePostUpdated);
            off("postDeleted", handlePostDeleted);
        };
    }, [socket, on, off]);

    useEffect(() => {
        if (savedPosts.length > 0) {
            fetchUserAvatars();
        }
    }, [savedPosts]);

    const fetchUserAvatars = async () => {
        try {
            const userIds = [...new Set(savedPosts.map(post => post.userId))];
            const missingUserIds = userIds.filter(id => !userAvatars[id]);
            if (missingUserIds.length === 0) return;

            const res = await axios.post("/api/users/batch", { userIds: missingUserIds });
            setUserAvatars(prev => {
                const newAvatars = { ...prev };
                Object.values(res.data).forEach(user => {
                    newAvatars[user.userId] = user.avatar;
                });
                return newAvatars;
            });
        } catch (error) {
            console.error("Error fetching user avatars:", error);
        }
    };

    const fetchSavedPosts = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("/api/posts", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const saved = res.data.filter(post => post.savedBy?.includes(user.userId));
            setSavedPosts(saved);
        } catch (error) {
            console.error("Error fetching saved posts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (postId, e) => {
        if (e) e.stopPropagation();
        setPostToDelete(postId);
        setShowDeleteModal(true);
    };

    const handleUnsavePost = async () => {
        if (!postToDelete) return;
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postToDelete}/save`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSavedPosts(savedPosts.filter(post => post.postId !== postToDelete));
            setPostToDelete(null);
        } catch (error) {
            console.error("Error unsaving post:", error);
        }
    };

    const formatTimeAgo = (date) => {
        if (!date) return "";
        const now = new Date();
        const postDate = new Date(date);
        const diffMs = now - postDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return postDate.toLocaleDateString();
    };

    // Optimized animation variants for GPU acceleration
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                duration: 0.2,
                staggerChildren: 0.03,
                when: "beforeChildren"
            }
        }
    };

    const itemVariants = {
        hidden: { 
            opacity: 0, 
            y: 10,
            willChange: "transform, opacity"
        },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: {
                duration: 0.2,
                ease: [0.25, 0.46, 0.45, 0.94]
            }
        }
    };

    return (
        <div className="min-h-screen md:pl-72 pt-4 pb-24 md:pb-4 dark:bg-[#111b21] bg-gray-50">
            <div className="max-w-5xl mx-auto px-3 sm:px-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="dark:bg-[#202c33] bg-white rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                                    <Bookmark className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold dark:text-white text-gray-900">Saved</h1>
                                    <p className="dark:text-[#8696a0] text-gray-500 text-sm">
                                        {savedPosts.length} {savedPosts.length === 1 ? 'item' : 'items'}
                                    </p>
                                </div>
                            </div>
                            {/* View Toggle */}
                            <div className="flex dark:bg-[#111b21] bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                                        viewMode === "list"
                                            ? "bg-[#00a884] text-white"
                                            : "dark:text-[#8696a0] text-gray-600"
                                    }`}
                                >
                                    List
                                </button>
                                <button
                                    onClick={() => setViewMode("compact")}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                                        viewMode === "compact"
                                            ? "bg-[#00a884] text-white"
                                            : "dark:text-[#8696a0] text-gray-600"
                                    }`}
                                >
                                    Compact
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <HamsterLoader size="medium" text="Loading saved posts..." />
                    </div>
                ) : savedPosts.length === 0 ? (
                    /* Empty State */
                    <div className="dark:bg-[#202c33] bg-white rounded-2xl p-12 text-center shadow-sm">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                            <BookmarkX className="w-10 h-10 dark:text-[#8696a0] text-gray-400" />
                        </div>
                        <h2 className="text-xl font-semibold dark:text-white text-gray-900 mb-2">Nothing saved yet</h2>
                        <p className="dark:text-[#8696a0] text-gray-500 max-w-sm mx-auto">
                            Tap the bookmark icon on any post to save it here for later
                        </p>
                    </div>
                ) : viewMode === "list" ? (
                    /* List View - Card Style */
                    <motion.div 
                        className="space-y-4 content-auto"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {savedPosts.map((post) => {
                            const hasMedia = post.media && post.media.length > 0;
                            const firstMedia = hasMedia ? post.media[0] : null;

                            return (
                                <motion.div
                                    key={post.postId}
                                    variants={itemVariants}
                                    onClick={() => navigate(`/post/${post.postId}`)}
                                    className="dark:bg-[#202c33] bg-white rounded-2xl overflow-hidden shadow-sm cursor-pointer dark:hover:bg-[#2a3942] hover:bg-gray-50 transition-colors duration-100 transform-gpu content-auto"
                                >
                                    <div className="flex">
                                        {/* Thumbnail */}
                                        {hasMedia && (
                                            <div className="w-48 h-48 flex-shrink-0 relative overflow-hidden">
                                                {firstMedia.type === "video" ? (
                                                    <div className="w-full h-full relative">
                                                        <video
                                                            src={firstMedia.url}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                                            <Play className="w-12 h-12 text-white fill-white" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <SafeImage
                                                        src={firstMedia.url}
                                                        alt="Saved post"
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                                            <div>
                                                {/* User Info */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <SafeAvatar
                                                        src={userAvatars[post.userId] || post.userAvatar}
                                                        alt={post.username}
                                                        fallbackText={post.username}
                                                        className="w-10 h-10 rounded-full"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="dark:text-white text-gray-900 font-semibold text-base truncate">
                                                                {post.username}
                                                            </span>
                                                            <span className="dark:text-[#8696a0] text-gray-500 text-sm">
                                                                • {formatTimeAgo(post.createdAt)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Post Content Preview */}
                                                {post.content && (
                                                    <p className="dark:text-[#d1d7db] text-gray-700 text-base line-clamp-3 mb-3">
                                                        {post.content}
                                                    </p>
                                                )}
                                                {!post.content && hasMedia && (
                                                    <p className="dark:text-[#8696a0] text-gray-500 text-sm italic mb-3">
                                                        {firstMedia.type === "video" ? "Video post" : "Photo post"}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Stats & Actions */}
                                            <div className="flex items-center justify-between pt-3 border-t dark:border-[#2a3942] border-gray-200">
                                                <div className="flex items-center gap-6 text-sm dark:text-[#8696a0] text-gray-500">
                                                    <span className="flex items-center gap-1.5">
                                                        <Heart className="w-4 h-4" />
                                                        {post.likes || 0}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <MessageCircle className="w-4 h-4" />
                                                        {post.comments?.length || 0}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={(e) => handleDeleteClick(post.postId, e)}
                                                    className="p-2 rounded-lg dark:hover:bg-red-500/20 hover:bg-red-50 dark:text-[#8696a0] text-gray-500 hover:text-red-500 transition-colors duration-150"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                ) : (
                    /* Compact View */
                    <motion.div 
                        className="dark:bg-[#202c33] bg-white rounded-2xl overflow-hidden shadow-sm divide-y dark:divide-[#2a3942] divide-gray-100"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {savedPosts.map((post) => {
                            const hasMedia = post.media && post.media.length > 0;
                            const firstMedia = hasMedia ? post.media[0] : null;

                            return (
                                <motion.div
                                    key={post.postId}
                                    variants={itemVariants}
                                    onClick={() => navigate(`/post/${post.postId}`)}
                                    className="flex items-center gap-3 p-3 cursor-pointer dark:hover:bg-[#2a3942] hover:bg-gray-50 transition-colors duration-100 transform-gpu"
                                >
                                    {/* Small Thumbnail or Avatar */}
                                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                                        {hasMedia ? (
                                            firstMedia.type === "video" ? (
                                                <div className="w-full h-full relative">
                                                    <video src={firstMedia.url} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                                                        <Play className="w-4 h-4 text-white fill-white" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <SafeImage src={firstMedia.url} alt="" className="w-full h-full object-cover" />
                                            )
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                                                <Bookmark className="w-5 h-5 dark:text-white/50 text-gray-400" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="dark:text-white text-gray-900 font-medium text-sm truncate">
                                                {post.username}
                                            </span>
                                        </div>
                                        <p className="dark:text-[#8696a0] text-gray-500 text-xs truncate">
                                            {post.content || (hasMedia ? (firstMedia.type === "video" ? "Video" : "Photo") : "Post")}
                                        </p>
                                    </div>

                                    {/* Time */}
                                    <div className="flex items-center gap-1 dark:text-[#8696a0] text-gray-400 text-xs flex-shrink-0">
                                        <Clock className="w-3 h-3" />
                                        {formatTimeAgo(post.createdAt)}
                                    </div>

                                    {/* Remove Button */}
                                    <button
                                        onClick={(e) => handleDeleteClick(post.postId, e)}
                                        className="p-2 rounded-lg dark:hover:bg-red-500/20 hover:bg-red-50 dark:text-[#8696a0] text-gray-400 hover:text-red-500 transition-colors duration-150 flex-shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Delete Confirmation Modal */}
                <ConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => {
                        setShowDeleteModal(false);
                        setPostToDelete(null);
                    }}
                    onConfirm={handleUnsavePost}
                    title="Remove from Saved?"
                    message="Are you sure you want to remove this post from your saved collection? You can always save it again later."
                    confirmText="Remove"
                    cancelText="Cancel"
                    type="danger"
                />
            </div>
        </div>
    );
};

export default Saved;
