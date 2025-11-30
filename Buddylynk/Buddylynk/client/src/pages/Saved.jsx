import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Heart, MessageCircle, Play, X, BookmarkX } from "lucide-react";
import { SafeAvatar, SafeImage } from "../components/SafeImage";
import HamsterLoader from "../components/HamsterLoader";
import axios from "axios";

const Saved = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { socket, on, off } = useSocket();
    const [savedPosts, setSavedPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState(null);
    const [userAvatars, setUserAvatars] = useState({});

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

    const handleUnsavePost = async (postId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/save`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSavedPosts(savedPosts.filter(post => post.postId !== postId));
            setSelectedPost(null);
        } catch (error) {
            console.error("Error unsaving post:", error);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.8 },
        visible: { 
            opacity: 1, 
            scale: 1,
            transition: { type: "spring", stiffness: 300, damping: 25 }
        }
    };

    return (
        <div className="min-h-screen md:pl-72 pt-4 pb-24 md:pb-4 dark:bg-dark bg-gray-100">
            <div className="max-w-6xl mx-auto px-3 sm:px-4">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 sm:mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <motion.div
                            className="p-2.5 sm:p-3 rounded-xl bg-primary/20"
                            whileHover={{ rotate: 10, scale: 1.1 }}
                        >
                            <Bookmark className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                        </motion.div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold dark:text-white text-gray-900">Saved Posts</h1>
                            <p className="text-theme-secondary text-xs sm:text-sm">
                                {savedPosts.length} {savedPosts.length === 1 ? 'post' : 'posts'} saved
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <HamsterLoader size="medium" text="Loading saved posts..." />
                    </div>
                ) : savedPosts.length === 0 ? (
                    /* Empty State */
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel p-12 text-center"
                    >
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            <BookmarkX className="w-20 h-20 text-theme-muted mx-auto mb-4" />
                        </motion.div>
                        <h2 className="text-2xl font-semibold dark:text-white text-gray-900 mb-2">No saved posts yet</h2>
                        <p className="text-theme-secondary max-w-md mx-auto">
                            Save posts you want to see again by tapping the bookmark icon
                        </p>
                    </motion.div>
                ) : (
                    /* Grid of Saved Posts */
                    <motion.div 
                        className="grid grid-cols-3 gap-0.5 sm:gap-1"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {savedPosts.map((post) => {
                            const hasMedia = post.media && post.media.length > 0;
                            const firstMedia = hasMedia ? post.media[0] : null;
                            const hasMultiple = post.media && post.media.length > 1;

                            return (
                                <motion.div
                                    key={post.postId}
                                    variants={itemVariants}
                                    onClick={() => setSelectedPost(post)}
                                    className="relative aspect-square bg-gray-200 dark:bg-gray-800 cursor-pointer group overflow-hidden"
                                    whileHover={{ scale: 1.02 }}
                                >
                                    {hasMedia ? (
                                        firstMedia.type === "video" ? (
                                            <video
                                                src={firstMedia.url}
                                                className="w-full h-full object-contain bg-black"
                                            />
                                        ) : (
                                            <SafeImage
                                                src={firstMedia.url}
                                                alt="Saved post"
                                                className="w-full h-full object-contain bg-black"
                                            />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-primary/20 to-secondary/20">
                                            <p className="dark:text-white text-gray-900 text-sm line-clamp-6 text-center">
                                                {post.content}
                                            </p>
                                        </div>
                                    )}

                                    {hasMultiple && (
                                        <div className="absolute top-2 right-2">
                                            <div className="bg-black/60 backdrop-blur-sm rounded-full p-1">
                                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}

                                    {firstMedia?.type === "video" && (
                                        <div className="absolute top-2 right-2">
                                            <div className="bg-black/60 backdrop-blur-sm rounded-full p-1">
                                                <Play className="w-4 h-4 text-white fill-white" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                                        <div className="flex items-center gap-2 text-white">
                                            <Heart className="w-6 h-6 fill-white" />
                                            <span className="font-semibold">{post.likes || 0}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-white">
                                            <MessageCircle className="w-6 h-6 fill-white" />
                                            <span className="font-semibold">{post.comments?.length || 0}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Post Detail Modal */}
                <AnimatePresence>
                    {selectedPost && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedPost(null)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                onClick={(e) => e.stopPropagation()}
                                className="glass-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20"
                            >
                                {/* Close Button */}
                                <motion.button
                                    onClick={() => setSelectedPost(null)}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                                    whileHover={{ scale: 1.1, rotate: 90 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <X className="w-5 h-5" />
                                </motion.button>

                                {/* Post Header */}
                                <div className="flex items-center justify-between p-4 border-b dark:border-white/10 border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <SafeAvatar
                                            src={userAvatars[selectedPost.userId] || selectedPost.userAvatar}
                                            alt={selectedPost.username}
                                            fallbackText={selectedPost.username}
                                            className="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                            onClick={() => {
                                                navigate(`/profile/${selectedPost.userId}`);
                                                setSelectedPost(null);
                                            }}
                                        />
                                        <div>
                                            <h3
                                                onClick={() => {
                                                    navigate(`/profile/${selectedPost.userId}`);
                                                    setSelectedPost(null);
                                                }}
                                                className="font-semibold dark:text-white text-gray-900 cursor-pointer hover:text-primary transition-colors"
                                            >
                                                {selectedPost.username}
                                            </h3>
                                            <p className="text-xs text-theme-secondary">
                                                {selectedPost.createdAt ? new Date(selectedPost.createdAt).toLocaleDateString() : 'Unknown date'}
                                            </p>
                                        </div>
                                    </div>
                                    <motion.button
                                        onClick={() => handleUnsavePost(selectedPost.postId)}
                                        className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <Bookmark className="w-6 h-6 fill-current" />
                                    </motion.button>
                                </div>

                                {/* Post Content */}
                                <div className="p-4">
                                    {selectedPost.content && (
                                        <p className="dark:text-gray-200 text-gray-800 mb-4 whitespace-pre-wrap">
                                            {selectedPost.content}
                                        </p>
                                    )}

                                    {selectedPost.media && selectedPost.media.length > 0 && (
                                        <div className="mb-4 rounded-xl overflow-hidden">
                                            {selectedPost.media[0].type === "video" ? (
                                                <video
                                                    src={selectedPost.media[0].url}
                                                    controls
                                                    className="w-full max-h-96 object-contain bg-black"
                                                />
                                            ) : (
                                                <SafeImage
                                                    src={selectedPost.media[0].url}
                                                    alt="Post content"
                                                    className="w-full max-h-96 object-contain bg-black"
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Post Stats */}
                                    <div className="flex items-center gap-6 text-sm text-theme-secondary pt-4 border-t dark:border-white/10 border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <Heart className="w-5 h-5" />
                                            <span>{selectedPost.likes || 0} likes</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MessageCircle className="w-5 h-5" />
                                            <span>{selectedPost.comments?.length || 0} comments</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Saved;
