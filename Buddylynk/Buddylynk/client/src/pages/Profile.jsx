import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRealTimeUser } from "../hooks/useRealTimeUser";
import { useToast } from "../context/ToastContext";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, UserPlus, UserMinus, MessageCircle, X, ChevronLeft, ChevronRight, MoreVertical, Trash2, Copy, Play } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";
import { SafeAvatar, SafeImage } from "../components/SafeImage";
import CenteredMedia from "../components/CenteredMedia";
import InstagramImageViewer from "../components/InstagramImageViewer";
import SensitiveMediaWrapper from "../components/SensitiveMediaWrapper";

const Profile = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [isFullscreenZoom, setIsFullscreenZoom] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerImages, setViewerImages] = useState([]);
    const [viewerPostData, setViewerPostData] = useState(null);
    
    // Post menu states
    const [showMenu, setShowMenu] = useState({});
    const [editingPost, setEditingPost] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

    const isOwnProfile = user?.userId === id;

    const setProfileUser = (updatedUserData) => {
        setProfile(prevProfile => {
            if (!prevProfile) return prevProfile;
            return {
                ...prevProfile,
                user: typeof updatedUserData === 'function' 
                    ? updatedUserData(prevProfile.user)
                    : { ...prevProfile.user, ...updatedUserData }
            };
        });
    };

    useRealTimeUser(id, setProfileUser);

    useEffect(() => { fetchProfile(); }, [id]);

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!selectedMedia) return;
            if (e.key === 'Escape') closeFullscreen();
            if (e.key === 'ArrowLeft') navigateMedia('prev');
            if (e.key === 'ArrowRight') navigateMedia('next');
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedMedia, currentMediaIndex]);

    useEffect(() => {
        const handleClickOutside = () => {
            if (Object.keys(showMenu).some(key => showMenu[key])) {
                setShowMenu({});
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showMenu]);

    useEffect(() => {
        const socket = window.socket;
        if (socket) {
            socket.on("postUpdated", (updatedPost) => {
                setProfile(prev => prev ? { ...prev, posts: prev.posts.map(p => p.postId === updatedPost.postId ? updatedPost : p) } : prev);
            });
            socket.on("postDeleted", (deletedPostId) => {
                setProfile(prev => prev ? { ...prev, posts: prev.posts.filter(p => p.postId !== deletedPostId) } : prev);
            });
            return () => { socket.off("postUpdated"); socket.off("postDeleted"); };
        }
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/users/${id}`);
            setProfile(res.data);
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        try {
            const token = localStorage.getItem("token");
            const isFollowing = user?.following?.includes(id);
            await axios.post(`/api/users/${isFollowing ? "unfollow" : "follow"}`, { targetUserId: id }, { headers: { Authorization: `Bearer ${token}` } });
            const updatedUser = { ...user, following: isFollowing ? user.following.filter(uid => uid !== id) : [...(user.following || []), id] };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            toast.success(isFollowing ? `Unfollowed ${profile?.user?.username}` : `Following ${profile?.user?.username}! 🎉`);
            fetchProfile();
        } catch (error) {
            console.error("Error following/unfollowing user:", error);
            toast.error("Something went wrong");
        }
    };

    const handleMessage = () => navigate("/chat");

    const toggleMenu = (postId, e) => {
        if (e) e.stopPropagation();
        setShowMenu(prev => ({ ...prev, [postId]: !prev[postId] }));
    };

    const handleEditPost = (post, e) => {
        if (e) e.stopPropagation();
        setEditingPost(post.postId);
        setEditContent(post.content || "");
        setShowMenu({});
    };

    const handleSaveEdit = async (postId) => {
        if (!editContent.trim()) return;
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("content", editContent);
            const res = await axios.put(`/api/posts/${postId}`, formData, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } });
            setProfile(prev => ({ ...prev, posts: prev.posts.map(p => p.postId === postId ? res.data : p) }));
            setEditingPost(null);
            setEditContent("");
            toast.success("Post updated successfully");
        } catch (error) {
            console.error("Error editing post:", error);
            toast.error("Failed to update post");
        }
    };

    const handleCancelEdit = () => { setEditingPost(null); setEditContent(""); };

    const confirmDeletePost = (postId, e) => {
        if (e) e.stopPropagation();
        setShowDeleteConfirm(postId);
        setShowMenu({});
    };

    const handleDeletePost = async (postId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
            setProfile(prev => ({ ...prev, posts: prev.posts.filter(p => p.postId !== postId) }));
            setShowDeleteConfirm(null);
            toast.success("Post deleted successfully");
        } catch (error) {
            console.error("Error deleting post:", error);
            toast.error("Failed to delete post");
        }
    };

    const navigateMedia = (direction) => {
        if (!selectedMedia) return;
        const totalMedia = selectedMedia.mediaItems.length;
        setCurrentMediaIndex(prev => direction === 'next' ? (prev + 1) % totalMedia : (prev - 1 + totalMedia) % totalMedia);
    };

    const handleMediaClick = (post, mediaItems) => {
        setViewerImages(mediaItems);
        setViewerPostData({ username: post.username, userAvatar: profile.user.avatar, content: post.content, likes: post.likes, comments: post.comments });
        setCurrentMediaIndex(0);
        setIsViewerOpen(true);
        setSelectedMedia({ post, mediaItems });
        setIsFullscreenZoom(false);
    };

    const handleImageZoom = () => setIsFullscreenZoom(!isFullscreenZoom);
    const closeFullscreen = () => { setSelectedMedia(null); setIsFullscreenZoom(false); };
    const closeViewer = () => { setIsViewerOpen(false); setViewerImages([]); setViewerPostData(null); setCurrentMediaIndex(0); };

    if (loading) {
        return (
            <div className="min-h-screen md:pl-72 pt-4 pb-20 md:pr-4">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="glass-panel p-8 animate-pulse">
                        <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded-t-xl mb-16" />
                        <div className="flex flex-col items-center">
                            <div className="w-32 h-32 bg-gray-300 dark:bg-gray-700 rounded-full" />
                            <div className="h-8 w-48 bg-gray-300 dark:bg-gray-700 rounded mt-4" />
                            <div className="h-4 w-64 bg-gray-300 dark:bg-gray-700 rounded mt-2" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) return <div className="dark:text-white text-gray-900 text-center mt-20">User not found</div>;

    return (
        <div className="min-h-screen md:pl-72 pb-24 md:pb-8 dark:bg-dark bg-gray-100">
            <div className="max-w-5xl mx-auto px-2 sm:px-4">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-4 sm:p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-24 sm:h-32 overflow-hidden">
                        {profile.user.banner ? (
                            <SafeImage src={profile.user.banner} alt="Profile banner" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-r from-primary/30 to-secondary/30" />
                        )}
                    </div>

                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                        {isOwnProfile ? (
                            <button onClick={() => navigate('/edit-profile')} className="p-2 rounded-full dark:bg-dark-lighter bg-white dark:border-white/10 border-gray-300 border dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/10 hover:bg-gray-100 transition-all">
                                <Edit2 className="w-5 h-5" />
                            </button>
                        ) : (
                            <>
                                {user?.following?.includes(id) && profile.user.following?.includes(user.userId) && (
                                    <button onClick={handleMessage} className="p-2 rounded-full bg-primary hover:bg-primary-hover text-white transition-all" title="Send Message">
                                        <MessageCircle className="w-5 h-5" />
                                    </button>
                                )}
                                <button onClick={handleFollow} className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${user?.following?.includes(id) ? "bg-gray-500 hover:bg-gray-600 text-white" : "bg-primary hover:bg-primary-hover text-white"}`}>
                                    {user?.following?.includes(id) ? (<><UserMinus className="w-4 h-4" />Unfollow</>) : (<><UserPlus className="w-4 h-4" />Follow</>)}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="relative z-10 mt-12 sm:mt-16">
                        <SafeAvatar src={profile.user.avatar} alt={profile.user.username} fallbackText={profile.user.username} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto border-4 border-dark shadow-xl ring-4 ring-primary/20" />
                        <h1 className="text-2xl sm:text-3xl font-bold mt-3 sm:mt-4 dark:text-white text-gray-900">{profile.user.username}</h1>
                        <p className="dark:text-gray-400 text-gray-600 mt-2 max-w-md mx-auto text-sm sm:text-base px-4">{profile.user.bio || "No bio yet"}</p>
                        <div className="flex gap-4 sm:gap-6 justify-center mt-4">
                            <div className="text-center px-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100">
                                <div className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900">{profile.user.followers?.length || 0}</div>
                                <div className="text-xs sm:text-sm dark:text-gray-400 text-gray-600">Followers</div>
                            </div>
                            <div className="text-center px-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100">
                                <div className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900">{profile.user.following?.length || 0}</div>
                                <div className="text-xs sm:text-sm dark:text-gray-400 text-gray-600">Following</div>
                            </div>
                            <div className="text-center px-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100">
                                <div className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900">{profile.posts?.length || 0}</div>
                                <div className="text-xs sm:text-sm dark:text-gray-400 text-gray-600">Posts</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Posts Section */}
                <div className="mt-6">
                    <h2 className="text-xl font-bold dark:text-white text-gray-900 px-2 mb-4">Posts</h2>
                    <div className="space-y-4">
                        {profile.posts.map((post, index) => {
                            const mediaItems = post.media || (post.mediaUrl ? [{ url: post.mediaUrl, type: post.mediaType }] : []);
                            const firstMedia = mediaItems[0];
                            const hasMultiple = mediaItems.length > 1;

                            return (
                                <motion.div key={post.postId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="glass-panel p-4">
                                    {/* Post Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <SafeAvatar src={profile.user.avatar} alt={profile.user.username} fallbackText={profile.user.username} className="w-10 h-10 rounded-full" />
                                            <div>
                                                <h3 className="font-bold dark:text-white text-gray-900">{profile.user.username}</h3>
                                                <p className="text-xs dark:text-gray-400 text-gray-600">
                                                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date'}
                                                    {post.editedAt && <span className="ml-2">(edited)</span>}
                                                </p>
                                            </div>
                                        </div>

                                        {/* 3-dot menu */}
                                        <div className="relative">
                                            <button onClick={(e) => toggleMenu(post.postId, e)} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                                <MoreVertical className="w-6 h-6" />
                                            </button>
                                            <AnimatePresence>
                                                {showMenu[post.postId] && (
                                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 mt-1 w-40 dark:bg-[#202c33] bg-white rounded-lg shadow-lg border dark:border-white/10 border-gray-200 z-50 overflow-hidden">
                                                        <button onClick={(e) => handleEditPost(post, e)} className="w-full flex items-center gap-3 px-4 py-3 dark:text-white text-gray-900 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors">
                                                            <Edit2 className="w-4 h-4" /><span>Edit Post</span>
                                                        </button>
                                                        <button onClick={(e) => confirmDeletePost(post.postId, e)} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors">
                                                            <Trash2 className="w-4 h-4" /><span>Delete Post</span>
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* Post Content */}
                                    {editingPost === post.postId ? (
                                        <div className="mb-4 space-y-3">
                                            <textarea className="input-field w-full min-h-[100px]" value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="What's on your mind?" autoFocus />
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={handleCancelEdit} className="px-4 py-2 dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900">Cancel</button>
                                                <button onClick={() => handleSaveEdit(post.postId)} className="btn-primary px-4 py-2" disabled={!editContent.trim()}>Save Changes</button>
                                            </div>
                                        </div>
                                    ) : post.content && (
                                        <p className="dark:text-gray-200 text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>
                                    )}

                                    {/* Media */}
                                    {editingPost !== post.postId && firstMedia && (
                                        <div className="relative rounded-xl overflow-hidden cursor-pointer" onClick={() => handleMediaClick(post, mediaItems)}>
                                            <SensitiveMediaWrapper isSensitive={firstMedia.isNsfw || post.isNsfw}>
                                                {firstMedia.type === "video" ? (
                                                    <video src={firstMedia.url} className="w-full max-h-[500px] object-contain bg-black" preload="metadata" />
                                                ) : (
                                                    <SafeImage src={firstMedia.url} alt="Post media" className="w-full max-h-[500px] object-contain bg-black" />
                                                )}
                                            </SensitiveMediaWrapper>
                                            {hasMultiple && (
                                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                                                    <Copy className="w-3 h-3" /> {mediaItems.length}
                                                </div>
                                            )}
                                            {firstMedia.type === "video" && (
                                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white p-1.5 rounded-full">
                                                    <Play className="w-4 h-4" fill="white" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                        {profile.posts.length === 0 && (
                            <div className="text-center dark:text-gray-500 text-gray-600 py-10">No posts yet</div>
                        )}
                    </div>
                </div>

                {/* Media Lightbox */}
                <AnimatePresence>
                    {selectedMedia && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedMedia(null)}>
                            <div className="absolute top-4 right-4 flex gap-2 z-10">
                                <button onClick={closeFullscreen} className="text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/10 transition-colors bg-black/50 backdrop-blur-sm">
                                    <X className="w-8 h-8" />
                                </button>
                            </div>
                            <div className={`w-full max-h-[90vh] overflow-y-auto glass-panel transition-all duration-300 ${isFullscreenZoom ? 'max-w-none h-full' : 'max-w-5xl'}`} onClick={(e) => e.stopPropagation()}>
                                {!isFullscreenZoom && (
                                    <div className="flex items-center gap-3 p-4 border-b dark:border-white/10 border-gray-200">
                                        <SafeAvatar src={profile.user.avatar} alt={selectedMedia.post.username} fallbackText={selectedMedia.post.username} className="w-10 h-10 rounded-full" />
                                        <div>
                                            <h3 className="font-bold dark:text-white text-gray-900">{selectedMedia.post.username}</h3>
                                            <p className="text-xs dark:text-gray-400 text-gray-600">{new Date(selectedMedia.post.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-black relative">
                                    <div onClick={handleImageZoom} className="cursor-zoom-in">
                                        <CenteredMedia media={selectedMedia.mediaItems[currentMediaIndex]} className={`max-w-full transition-all duration-300 ${isFullscreenZoom ? 'max-h-[95vh] cursor-zoom-out' : 'max-h-[70vh] cursor-zoom-in'}`} containerClassName="w-full" controls={selectedMedia.mediaItems[currentMediaIndex].type === "video"} />
                                    </div>
                                    {selectedMedia.mediaItems.length > 1 && (
                                        <>
                                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">{currentMediaIndex + 1}/{selectedMedia.mediaItems.length}</div>
                                            <button onClick={(e) => { e.stopPropagation(); navigateMedia('prev'); }} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 text-gray-900 p-3 rounded-full shadow-2xl transition-all disabled:opacity-30" disabled={currentMediaIndex === 0}>
                                                <ChevronLeft className="w-6 h-6" strokeWidth={3} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); navigateMedia('next'); }} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 text-gray-900 p-3 rounded-full shadow-2xl transition-all disabled:opacity-30" disabled={currentMediaIndex === selectedMedia.mediaItems.length - 1}>
                                                <ChevronRight className="w-6 h-6" strokeWidth={3} />
                                            </button>
                                        </>
                                    )}
                                </div>
                                {!isFullscreenZoom && (
                                    <div className="p-4">
                                        <p className="dark:text-gray-200 text-gray-800 whitespace-pre-wrap">{selectedMedia.post.content}</p>
                                        <div className="flex items-center gap-4 mt-4 text-sm dark:text-gray-400 text-gray-600">
                                            <span>{selectedMedia.post.likes || 0} likes</span>
                                            <span>{selectedMedia.post.comments?.length || 0} comments</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <InstagramImageViewer isOpen={isViewerOpen} onClose={closeViewer} images={viewerImages} initialIndex={currentMediaIndex} postData={viewerPostData} />

                <ConfirmModal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} onConfirm={() => handleDeletePost(showDeleteConfirm)} title="Delete Post" message="Are you sure you want to delete this post? This action cannot be undone." confirmText="Delete" type="danger" />
            </div>
        </div>
    );
};

export default Profile;
