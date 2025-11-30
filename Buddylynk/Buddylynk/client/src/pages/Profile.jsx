import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRealTimeUser } from "../hooks/useRealTimeUser";
import { useToast } from "../context/ToastContext";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, UserPlus, UserMinus, MessageCircle, MapPin, Calendar, Mail, Briefcase, Grid3x3, List, Copy, Play, X, ChevronLeft, ChevronRight } from "lucide-react";
import { SafeAvatar, SafeImage } from "../components/SafeImage";
import VideoPlayer from "../components/VideoPlayer";
import CenteredMedia from "../components/CenteredMedia";
import InstagramImageViewer from "../components/InstagramImageViewer";

const Profile = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("posts");
    const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [isFullscreenZoom, setIsFullscreenZoom] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerImages, setViewerImages] = useState([]);
    const [viewerPostData, setViewerPostData] = useState(null);

    const isOwnProfile = user?.userId === id;

    // Custom setter for real-time user updates
    const setProfileUser = (updatedUserData) => {
        setProfile(prevProfile => {
            if (!prevProfile) return prevProfile;
            return {
                ...prevProfile,
                user: typeof updatedUserData === 'function' 
                    ? updatedUserData(prevProfile.user)
                    : {
                        ...prevProfile.user,
                        ...updatedUserData,
                    }
            };
        });
    };

    // Real-time user updates (follow/unfollow, profile changes)
    useRealTimeUser(id, setProfileUser);

    useEffect(() => {
        fetchProfile();
    }, [id]);

    // Keyboard navigation for media carousel
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!selectedMedia) return;
            if (e.key === 'Escape') closeFullscreen();
            if (e.key === 'ArrowLeft') navigateMedia('prev');
            if (e.key === 'ArrowRight') navigateMedia('next');
            if (e.key === 'z' || e.key === 'Z') handleImageZoom();
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedMedia, currentMediaIndex, isFullscreenZoom]);

    // Touch support for mobile devices
    useEffect(() => {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        const handleTouchStart = (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        };

        const handleTouchEnd = (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        };

        const handleSwipe = () => {
            if (!selectedMedia) return;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const minSwipeDistance = 50;

            // Horizontal swipe (left/right navigation)
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                if (deltaX > 0) {
                    navigateMedia('prev'); // Swipe right = previous
                } else {
                    navigateMedia('next'); // Swipe left = next
                }
            }
        };

        if (selectedMedia) {
            document.addEventListener('touchstart', handleTouchStart);
            document.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [selectedMedia, currentMediaIndex]);

    // Real-time post updates via Socket.IO
    useEffect(() => {
        const socket = window.socket;
        if (socket) {
            socket.on("postUpdated", (updatedPost) => {
                setProfile(prevProfile => {
                    if (!prevProfile) return prevProfile;
                    return {
                        ...prevProfile,
                        posts: prevProfile.posts.map(post =>
                            post.postId === updatedPost.postId ? updatedPost : post
                        )
                    };
                });
            });

            socket.on("postDeleted", (deletedPostId) => {
                setProfile(prevProfile => {
                    if (!prevProfile) return prevProfile;
                    return {
                        ...prevProfile,
                        posts: prevProfile.posts.filter(post => post.postId !== deletedPostId)
                    };
                });
            });

            return () => {
                socket.off("postUpdated");
                socket.off("postDeleted");
            };
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
            const endpoint = isFollowing ? "unfollow" : "follow";

            await axios.post(`/api/users/${endpoint}`,
                { targetUserId: id },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local user state
            const updatedUser = {
                ...user,
                following: isFollowing
                    ? user.following.filter(uid => uid !== id)
                    : [...(user.following || []), id]
            };
            localStorage.setItem("user", JSON.stringify(updatedUser));

            // Show toast
            toast.success(isFollowing ? `Unfollowed ${profile?.user?.username}` : `Following ${profile?.user?.username}! 🎉`);

            // Refresh profile to update follower count
            fetchProfile();
        } catch (error) {
            console.error("Error following/unfollowing user:", error);
            toast.error("Something went wrong");
        }
    };

    const handleMessage = () => {
        navigate("/chat");
    };

    const navigateMedia = (direction) => {
        if (!selectedMedia) return;
        const totalMedia = selectedMedia.mediaItems.length;
        if (direction === 'next') {
            setCurrentMediaIndex((prev) => (prev + 1) % totalMedia);
        } else {
            setCurrentMediaIndex((prev) => (prev - 1 + totalMedia) % totalMedia);
        }
    };

    const handleMediaClick = (post, mediaItems) => {
        // Use new Instagram-style viewer
        setViewerImages(mediaItems);
        setViewerPostData({
            username: post.username,
            userAvatar: profile.user.avatar,
            content: post.content,
            likes: post.likes,
            comments: post.comments
        });
        setCurrentMediaIndex(0);
        setIsViewerOpen(true);
        
        // Keep old functionality as fallback
        setSelectedMedia({ post, mediaItems });
        setIsFullscreenZoom(false);
    };

    const handleImageZoom = () => {
        setIsFullscreenZoom(!isFullscreenZoom);
    };

    const closeFullscreen = () => {
        setSelectedMedia(null);
        setIsFullscreenZoom(false);
    };

    const closeViewer = () => {
        setIsViewerOpen(false);
        setViewerImages([]);
        setViewerPostData(null);
        setCurrentMediaIndex(0);
    };

    if (loading) {
        return (
            <div className="min-h-screen md:pl-72 pt-4 pb-20 md:pr-4">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Loading Skeleton */}
                    <div className="glass-panel p-8 animate-pulse">
                        <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded-t-xl mb-16" />
                        <div className="flex flex-col items-center">
                            <div className="w-32 h-32 bg-gray-300 dark:bg-gray-700 rounded-full" />
                            <div className="h-8 w-48 bg-gray-300 dark:bg-gray-700 rounded mt-4" />
                            <div className="h-4 w-64 bg-gray-300 dark:bg-gray-700 rounded mt-2" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="glass-panel p-4 animate-pulse">
                                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2" />
                                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) return <div className="dark:text-white text-gray-900 text-center mt-20">User not found</div>;

    const tabs = [
        { id: "posts", label: "Posts" },
        { id: "about", label: "About" },
    ];

    return (
        <div className="min-h-screen md:pl-72 pb-24 md:pb-8 dark:bg-dark bg-gray-100">
            <div className="max-w-5xl mx-auto px-2 sm:px-4">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-4 sm:p-8 text-center relative overflow-hidden"
                >
                    {/* Banner Image */}
                    <div className="absolute top-0 left-0 w-full h-24 sm:h-32 overflow-hidden">
                        {profile.user.banner ? (
                            <SafeImage
                                src={profile.user.banner}
                                alt="Profile banner"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-r from-primary/30 to-secondary/30" />
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                        {isOwnProfile ? (
                            <button
                                onClick={() => navigate('/edit-profile')}
                                className="p-2 rounded-full dark:bg-dark-lighter bg-white dark:border-white/10 border-gray-300 border dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/10 hover:bg-gray-100 transition-all"
                            >
                                <Edit2 className="w-5 h-5" />
                            </button>
                        ) : (
                            <>
                                {/* Message button - only if mutual following */}
                                {user?.following?.includes(id) && profile.user.following?.includes(user.userId) && (
                                    <button
                                        onClick={handleMessage}
                                        className="p-2 rounded-full bg-primary hover:bg-primary-hover text-white transition-all"
                                        title="Send Message"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                    </button>
                                )}

                                {/* Follow/Unfollow button */}
                                <button
                                    onClick={handleFollow}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${user?.following?.includes(id)
                                            ? "bg-gray-500 hover:bg-gray-600 text-white"
                                            : "bg-primary hover:bg-primary-hover text-white"
                                        }`}
                                >
                                    {user?.following?.includes(id) ? (
                                        <>
                                            <UserMinus className="w-4 h-4" />
                                            Unfollow
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="w-4 h-4" />
                                            Follow
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="relative z-10 mt-12 sm:mt-16">
                        <SafeAvatar
                            src={profile.user.avatar}
                            alt={profile.user.username}
                            fallbackText={profile.user.username}
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto border-4 border-dark shadow-xl ring-4 ring-primary/20"
                        />
                        <h1 className="text-2xl sm:text-3xl font-bold mt-3 sm:mt-4 dark:text-white text-gray-900">{profile.user.username}</h1>
                        <p className="dark:text-gray-400 text-gray-600 mt-2 max-w-md mx-auto text-sm sm:text-base px-4">{profile.user.bio || "No bio yet"}</p>

                        {/* Follower/Following Stats */}
                        <div className="flex gap-4 sm:gap-6 justify-center mt-4">
                            <div className="text-center px-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100">
                                <div className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900">
                                    {profile.user.followers?.length || 0}
                                </div>
                                <div className="text-xs sm:text-sm dark:text-gray-400 text-gray-600">Followers</div>
                            </div>
                            <div className="text-center px-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100">
                                <div className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900">
                                    {profile.user.following?.length || 0}
                                </div>
                                <div className="text-xs sm:text-sm dark:text-gray-400 text-gray-600">Following</div>
                            </div>
                            <div className="text-center px-3 py-2 rounded-xl dark:bg-white/5 bg-gray-100">
                                <div className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900">
                                    {profile.posts?.length || 0}
                                </div>
                                <div className="text-xs sm:text-sm dark:text-gray-400 text-gray-600">Posts</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* View Toggle */}
                <div className="flex justify-between items-center px-2 sm:px-4 mt-4 sm:mt-6">
                    <h2 className="text-lg sm:text-xl font-bold dark:text-white text-gray-900">Posts</h2>
                    <div className="flex gap-1 sm:gap-2">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2.5 sm:p-2 rounded-xl transition-colors ${viewMode === "grid"
                                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                                    : "dark:text-gray-400 text-gray-600 dark:hover:bg-white/10 hover:bg-gray-200"
                                }`}
                        >
                            <Grid3x3 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2.5 sm:p-2 rounded-xl transition-colors ${viewMode === "list"
                                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                                    : "dark:text-gray-400 text-gray-600 dark:hover:bg-white/10 hover:bg-gray-200"
                                }`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Posts - Grid View */}
                {viewMode === "grid" ? (
                    <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-2 sm:p-4">
                        {profile.posts
                            .filter(post => (post.media && post.media.length > 0) || post.mediaUrl)
                            .map((post) => {
                                const mediaItems = post.media || (post.mediaUrl ? [{ url: post.mediaUrl, type: post.mediaType }] : []);
                                const firstMedia = mediaItems[0];
                                const hasMultiple = mediaItems.length > 1;

                                return (
                                    <motion.div
                                        key={post.postId}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="relative aspect-square cursor-pointer group overflow-hidden"
                                        onClick={() => handleMediaClick(post, mediaItems)}
                                    >
                                        <CenteredMedia
                                            media={firstMedia}
                                            className="w-full h-full"
                                            containerClassName="w-full h-full aspect-square"
                                            loading="lazy"
                                            preload={firstMedia.type === "video" ? "metadata" : undefined}
                                        />

                                        {/* Multiple media indicator */}
                                        {hasMultiple && (
                                            <div className="absolute top-2 right-2 text-white z-10">
                                                <Copy className="w-6 h-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" fill="white" strokeWidth={1.5} />
                                            </div>
                                        )}
                                        
                                        {/* Video indicator */}
                                        {firstMedia.type === "video" && (
                                            <div className="absolute top-2 left-2 text-white z-10">
                                                <Play className="w-6 h-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" fill="white" strokeWidth={1.5} />
                                            </div>
                                        )}

                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                                            <div className="flex items-center gap-1">
                                                <MessageCircle className="w-5 h-5" fill="white" />
                                                <span className="font-semibold">{post.comments?.length || 0}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        {profile.posts.filter(post => (post.media && post.media.length > 0) || post.mediaUrl).length === 0 && (
                            <div className="col-span-3 text-center dark:text-gray-500 text-gray-600 py-10">
                                No media posts yet
                            </div>
                        )}
                    </div>
                ) : (
                    /* Posts - List View */
                    <div className="space-y-6 p-4">
                        {profile.posts.map((post, index) => (
                            <motion.div
                                key={post.postId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="glass-panel p-4"
                            >
                                <p className="dark:text-gray-200 text-gray-800 mb-4">{post.content}</p>
                                {post.mediaUrl && (
                                    <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center">
                                        {post.mediaType === "video" ? (
                                            <video src={post.mediaUrl} controls className="w-full max-h-[600px] object-contain mx-auto" preload="metadata" />
                                        ) : (
                                            <SafeImage
                                                src={post.mediaUrl}
                                                alt="Post content"
                                                className="w-full max-h-[600px] object-contain mx-auto"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                                {/* Support for multiple media */}
                                {post.media && post.media.length > 0 && (
                                    <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center">
                                        {post.media[0].type === "video" ? (
                                            <video src={post.media[0].url} controls className="w-full max-h-[600px] object-contain mx-auto" preload="metadata" />
                                        ) : (
                                            <SafeImage
                                                src={post.media[0].url}
                                                alt="Post content"
                                                className="w-full max-h-[600px] object-contain mx-auto"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                        {profile.posts.length === 0 && (
                            <div className="text-center dark:text-gray-500 text-gray-600 py-10">No posts yet</div>
                        )}
                    </div>
                )}

                {/* Media Lightbox */}
                <AnimatePresence>
                    {selectedMedia && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setSelectedMedia(null)}
                        >
                            <div className="absolute top-2 md:top-4 right-2 md:right-4 flex gap-1 md:gap-2 z-10">
                                <button
                                    onClick={handleImageZoom}
                                    className="text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/10 transition-colors bg-black/50 backdrop-blur-sm"
                                    title={isFullscreenZoom ? "Exit Fullscreen" : "Fullscreen Zoom"}
                                >
                                    {isFullscreenZoom ? (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    onClick={closeFullscreen}
                                    className="text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/10 transition-colors bg-black/50 backdrop-blur-sm"
                                >
                                    <X className="w-6 h-6 md:w-8 md:h-8" />
                                </button>
                            </div>

                            <div
                                className={`w-full max-h-[90vh] overflow-y-auto glass-panel transition-all duration-300 ${
                                    isFullscreenZoom ? 'max-w-none h-full md:max-w-none' : 'max-w-5xl md:max-w-5xl max-w-[95vw]'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Post Header */}
                                {!isFullscreenZoom && (
                                    <div className="flex items-center gap-3 p-4 border-b dark:border-white/10 border-gray-200">
                                    <SafeAvatar
                                        src={profile.user.avatar}
                                        alt={selectedMedia.post.username}
                                        fallbackText={selectedMedia.post.username}
                                        className="w-10 h-10 rounded-full"
                                    />
                                    <div>
                                        <h3 className="font-bold dark:text-white text-gray-900">
                                            {selectedMedia.post.username}
                                        </h3>
                                        <p className="text-xs dark:text-gray-400 text-gray-600">
                                            {new Date(selectedMedia.post.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                )}

                                {/* Media Carousel */}
                                <div className="bg-black relative">
                                    <div onClick={handleImageZoom} className="cursor-zoom-in">
                                        <CenteredMedia
                                            media={selectedMedia.mediaItems[currentMediaIndex]}
                                            className={`max-w-full transition-all duration-300 ${
                                                isFullscreenZoom 
                                                    ? 'max-h-[95vh] md:max-h-[95vh] cursor-zoom-out' 
                                                    : 'max-h-[60vh] md:max-h-[85vh] cursor-zoom-in'
                                            }`}
                                            containerClassName={`w-full media-carousel-container transition-all duration-300 ${
                                                isFullscreenZoom 
                                                    ? 'min-h-[95vh] md:min-h-[95vh]' 
                                                    : 'min-h-[50vh] md:min-h-[70vh]'
                                            }`}
                                            containerStyle={{ 
                                                minHeight: isFullscreenZoom ? '95vh' : window.innerWidth < 768 ? '50vh' : '70vh'
                                            }}
                                            style={{ 
                                                maxHeight: isFullscreenZoom ? '95vh' : window.innerWidth < 768 ? '60vh' : '85vh'
                                            }}
                                            controls={selectedMedia.mediaItems[currentMediaIndex].type === "video"}
                                        />
                                    </div>

                                    {/* Counter Badge */}
                                    {selectedMedia.mediaItems.length > 1 && (
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                                            {currentMediaIndex + 1}/{selectedMedia.mediaItems.length}
                                        </div>
                                    )}

                                    {/* Navigation Arrows - Always show if multiple media */}
                                    {selectedMedia.mediaItems.length > 1 && (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigateMedia('prev');
                                                }}
                                                style={{ zIndex: 9999 }}
                                                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 text-gray-900 p-2 md:p-4 rounded-full shadow-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                disabled={currentMediaIndex === 0}
                                            >
                                                <ChevronLeft className="w-5 h-5 md:w-7 md:h-7" strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigateMedia('next');
                                                }}
                                                style={{ zIndex: 9999 }}
                                                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-100 text-gray-900 p-2 md:p-4 rounded-full shadow-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                disabled={currentMediaIndex === selectedMedia.mediaItems.length - 1}
                                            >
                                                <ChevronRight className="w-5 h-5 md:w-7 md:h-7" strokeWidth={3} />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Post Content */}
                                {!isFullscreenZoom && (
                                    <div className="p-4">
                                    <p className="dark:text-gray-200 text-gray-800 whitespace-pre-wrap">
                                        {selectedMedia.post.content}
                                    </p>
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

                {/* Instagram-style Image Viewer */}
                <InstagramImageViewer
                    isOpen={isViewerOpen}
                    onClose={closeViewer}
                    images={viewerImages}
                    initialIndex={currentMediaIndex}
                    postData={viewerPostData}
                />
            </div>
        </div>
    );
};

export default Profile;
