import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRealTimeUser } from "../hooks/useRealTimeUser";
import { useToast } from "../context/ToastContext";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Edit2, UserPlus, UserCheck, MessageCircle, Calendar, MoreVertical, Flag, 
    Grid3X3, BookOpen, Heart, Share2, MessageSquare, MapPin, Link as LinkIcon,
    Camera, Verified, Sparkles
} from "lucide-react";
import { SafeAvatar, SafeImage } from "../components/SafeImage";
import ConfirmModal from "../components/ConfirmModal";
import VideoPlayer from "../components/VideoPlayer";
import { AvatarWithStatus } from "../components/OnlineIndicator";

const ProfileNew = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("posts");
    const [showMenu, setShowMenu] = useState(false);
    const [showReportConfirm, setShowReportConfirm] = useState(false);
    const toast = useToast();
    
    const isOwnProfile = user?.userId === id;
    const isFollowing = user?.following?.includes(id);

    useEffect(() => {
        fetchProfile();
    }, [id]);

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

    useEffect(() => {
        const handleStorageChange = () => {
            const updatedUser = JSON.parse(localStorage.getItem("user"));
            if (updatedUser) setProfile(prev => prev ? {...prev} : null);
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const fetchProfile = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const res = await axios.get(`/api/users/${id}`);
            setProfile(res.data);
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const handleFollow = async () => {
        const currentlyFollowing = user?.following?.includes(id);
        const updatedUser = {
            ...user,
            following: currentlyFollowing 
                ? (user.following || []).filter(uid => uid !== id)
                : [...(user.following || []), id]
        };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('storage'));
        
        try {
            const token = localStorage.getItem("token");
            const endpoint = currentlyFollowing ? "unfollow" : "follow";
            await axios.post(`/api/users/${endpoint}`, 
                { targetUserId: id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await fetchProfile(false);
        } catch (error) {
            console.error("Error following/unfollowing user:", error);
            localStorage.setItem("user", JSON.stringify(user));
            window.dispatchEvent(new Event('storage'));
        }
    };

    const handleMessage = () => {
        navigate("/chat", { 
            state: { 
                selectedUser: {
                    userId: profile.user.userId,
                    username: profile.user.username,
                    avatar: profile.user.avatar
                }
            }
        });
    };

    const handleReport = () => {
        setShowReportConfirm(true);
        setShowMenu(false);
    };

    const executeReport = () => {
        toast.success("User reported. Thank you for helping keep our community safe.");
    };

    if (loading) {
        return (
            <div className="min-h-screen md:pl-72 pt-4 pb-20 dark:bg-dark bg-gray-50">
                <div className="max-w-4xl mx-auto px-4">
                    {/* Skeleton */}
                    <div className="animate-pulse">
                        <div className="h-48 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-b-3xl" />
                        <div className="flex flex-col items-center -mt-16">
                            <div className="w-32 h-32 bg-gray-300 dark:bg-gray-700 rounded-full border-4 border-white dark:border-dark" />
                            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-40 mt-4" />
                            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-60 mt-2" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    if (!profile) return (
        <div className="min-h-screen md:pl-72 flex items-center justify-center dark:bg-dark bg-gray-50">
            <p className="dark:text-white text-gray-900">User not found</p>
        </div>
    );

    const tabs = [
        { id: "posts", label: "Posts", icon: Grid3X3, count: profile.posts?.length || 0 },
        { id: "about", label: "About", icon: BookOpen },
    ];

    const totalLikes = profile.posts?.reduce((sum, post) => sum + (post.likes || 0), 0) || 0;

    return (
        <div className="min-h-screen md:pl-72 pb-20 dark:bg-dark bg-gray-50">

            {/* Hero Section with Cover */}
            <div className="relative">
                {/* Cover Image */}
                <div className="h-48 md:h-64 w-full overflow-hidden">
                    {profile.user.banner ? (
                        <SafeImage
                            src={profile.user.banner}
                            alt="Cover"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary via-purple-500 to-secondary" />
                    )}
                    {/* Overlay gradient - only on mobile for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:hidden" />
                </div>

                {/* Profile Info Card - Glassy Effect */}
                <div className="max-w-4xl mx-auto px-4">
                    <div className="relative -mt-12 md:-mt-16">
                        {/* Glassy Background Card */}
                        <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 rounded-2xl shadow-xl border border-white/50 dark:border-white/10 p-4 md:p-5">
                            <div className="flex items-center gap-4 md:gap-5">
                                {/* Avatar - Left Side */}
                                <div className="relative group flex-shrink-0">
                                    <AvatarWithStatus userId={profile.user.userId} indicatorSize="lg">
                                        <SafeAvatar
                                            src={profile.user.avatar}
                                            alt={profile.user.username}
                                            fallbackText={profile.user.username}
                                            className="w-20 h-20 md:w-28 md:h-28 rounded-full border-3 border-white dark:border-gray-800 shadow-xl ring-2 ring-primary/20"
                                        />
                                    </AvatarWithStatus>
                                    {isOwnProfile && (
                                        <button 
                                            onClick={() => navigate('/edit-profile')}
                                            className="absolute bottom-1 right-1 p-1.5 bg-primary rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Camera className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Name and Bio - Center */}
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-xl md:text-2xl font-bold dark:text-white text-gray-900 flex items-center gap-2 truncate">
                                        {profile.user.username}
                                        {profile.user.verified && (
                                            <Verified className="w-5 h-5 text-primary fill-primary flex-shrink-0" />
                                        )}
                                    </h1>
                                    {profile.user.bio && (
                                        <p className="dark:text-gray-300 text-gray-600 mt-1 text-sm line-clamp-2">
                                            {profile.user.bio}
                                        </p>
                                    )}
                                </div>

                                {/* Action Buttons - Right Side */}
                                <div className="flex gap-2 flex-shrink-0">
                                    {isOwnProfile ? (
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => navigate('/edit-profile')}
                                            className="flex items-center gap-2 px-4 md:px-5 py-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200/50 dark:border-white/20 dark:text-white text-gray-900 font-medium hover:bg-white/80 dark:hover:bg-white/20 transition-all text-sm"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            <span className="hidden sm:inline">Edit Profile</span>
                                        </motion.button>
                                    ) : (
                                        <>
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={handleFollow}
                                                className={`flex items-center gap-2 px-4 md:px-5 py-2 rounded-full font-medium transition-all text-sm ${
                                                    isFollowing
                                                        ? "bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200/50 dark:border-white/20 dark:text-white text-gray-900"
                                                        : "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25"
                                                }`}
                                            >
                                                {isFollowing ? (
                                                    <><UserCheck className="w-4 h-4" /><span className="hidden sm:inline">Following</span></>
                                                ) : (
                                                    <><UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Follow</span></>
                                                )}
                                            </motion.button>
                                            {isFollowing && (
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={handleMessage}
                                                    className="flex items-center gap-2 px-4 md:px-5 py-2 rounded-full bg-primary text-white font-medium transition-all text-sm shadow-lg shadow-primary/25"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Message</span>
                                                </motion.button>
                                            )}
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowMenu(!showMenu)}
                                                    className="p-2 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200/50 dark:border-white/20 dark:text-white text-gray-900"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                <AnimatePresence>
                                                    {showMenu && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95 }}
                                                            className="absolute right-0 mt-2 w-48 backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 rounded-xl shadow-xl border border-white/50 dark:border-white/10 z-50 overflow-hidden"
                                                        >
                                                            <button
                                                                onClick={handleReport}
                                                                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50/50 dark:hover:bg-red-500/10 transition-colors"
                                                            >
                                                                <Flag className="w-4 h-4" />
                                                                Report User
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Stats Cards */}
            <div className="max-w-4xl mx-auto px-4 mt-6">
                <div className="grid grid-cols-4 gap-3 md:gap-4">
                    {[
                        { label: "Posts", value: profile.posts?.length || 0, icon: Grid3X3 },
                        { label: "Followers", value: profile.user.followers?.length || 0, icon: UserPlus },
                        { label: "Following", value: profile.user.following?.length || 0, icon: UserCheck },
                        { label: "Likes", value: totalLikes, icon: Heart },
                    ].map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-white dark:bg-dark-lighter rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-white/5"
                        >
                            <stat.icon className="w-5 h-5 mx-auto mb-2 text-primary" />
                            <div className="text-xl md:text-2xl font-bold dark:text-white text-gray-900">
                                {stat.value >= 1000 ? `${(stat.value / 1000).toFixed(1)}k` : stat.value}
                            </div>
                            <div className="text-xs md:text-sm dark:text-gray-400 text-gray-500">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>

            </div>

            {/* Tabs */}
            <div className="max-w-4xl mx-auto px-4 mt-6">
                <div className="bg-white dark:bg-dark-lighter rounded-2xl p-1 shadow-sm border border-gray-100 dark:border-white/5">
                    <div className="flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                                    activeTab === tab.id
                                        ? "bg-primary text-white shadow-md"
                                        : "dark:text-gray-400 text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5"
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                                {tab.count !== undefined && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        activeTab === tab.id ? "bg-white/20" : "bg-gray-200 dark:bg-white/10"
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>


            {/* Tab Content */}
            <div className="max-w-4xl mx-auto px-4 mt-6 pb-8">
                <AnimatePresence mode="wait">
                    {/* Posts Tab */}
                    {activeTab === "posts" && (
                        <motion.div
                            key="posts"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-4"
                        >
                            {profile.posts.length === 0 ? (
                                <div className="bg-white dark:bg-dark-lighter rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-white/5">
                                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                    <p className="dark:text-gray-400 text-gray-500 text-lg">No posts yet</p>
                                    {isOwnProfile && (
                                        <button
                                            onClick={() => navigate('/')}
                                            className="mt-4 px-6 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition-colors"
                                        >
                                            Create your first post
                                        </button>
                                    )}
                                </div>
                            ) : (
                                profile.posts.map((post, index) => (
                                    <motion.div
                                        key={post.postId}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-white dark:bg-dark-lighter rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden"
                                    >
                                        {/* Post Header */}
                                        <div className="flex items-center gap-3 p-4">
                                            <SafeAvatar
                                                src={profile.user.avatar}
                                                alt={profile.user.username}
                                                fallbackText={profile.user.username}
                                                className="w-10 h-10 rounded-full"
                                            />
                                            <div className="flex-1">
                                                <p className="font-semibold dark:text-white text-gray-900">{profile.user.username}</p>
                                                <p className="text-xs dark:text-gray-400 text-gray-500">
                                                    {new Date(post.createdAt).toLocaleDateString('en-US', { 
                                                        month: 'short', day: 'numeric', year: 'numeric' 
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Post Content */}
                                        {post.content && (
                                            <p className="px-4 pb-3 dark:text-gray-200 text-gray-800 whitespace-pre-wrap">
                                                {post.content}
                                            </p>
                                        )}

                                        {/* Media */}
                                        {post.media && post.media.length > 0 && (
                                            <div className="bg-black">
                                                {post.media[0].type === "video" ? (
                                                    <VideoPlayer src={post.media[0].url} />
                                                ) : (
                                                    <SafeImage
                                                        src={post.media[0].url}
                                                        alt="Post content"
                                                        className="w-full max-h-[500px] object-contain"
                                                        loading="lazy"
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {post.mediaUrl && !post.media && (
                                            <div className="bg-black">
                                                {post.mediaType === "video" ? (
                                                    <video src={post.mediaUrl} controls className="w-full max-h-[500px] object-contain" preload="metadata" />
                                                ) : (
                                                    <SafeImage
                                                        src={post.mediaUrl}
                                                        alt="Post content"
                                                        className="w-full max-h-[500px] object-contain"
                                                        loading="lazy"
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {/* Post Actions */}
                                        <div className="flex items-center gap-6 px-4 py-3 border-t border-gray-100 dark:border-white/5">
                                            <button className="flex items-center gap-2 dark:text-gray-400 text-gray-500 hover:text-red-500 transition-colors">
                                                <Heart className="w-5 h-5" />
                                                <span className="text-sm font-medium">{post.likes || 0}</span>
                                            </button>
                                            <button className="flex items-center gap-2 dark:text-gray-400 text-gray-500 hover:text-primary transition-colors">
                                                <MessageSquare className="w-5 h-5" />
                                                <span className="text-sm font-medium">{post.comments?.length || 0}</span>
                                            </button>
                                            <button className="flex items-center gap-2 dark:text-gray-400 text-gray-500 hover:text-green-500 transition-colors">
                                                <Share2 className="w-5 h-5" />
                                                <span className="text-sm font-medium">{post.shares || 0}</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </motion.div>
                    )}

                    {/* About Tab */}
                    {activeTab === "about" && (
                        <motion.div
                            key="about"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-4"
                        >
                            {/* Bio Card */}
                            <div className="bg-white dark:bg-dark-lighter rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                                <h3 className="text-lg font-bold mb-3 dark:text-white text-gray-900 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-primary" />
                                    About
                                </h3>
                                <p className="dark:text-gray-300 text-gray-600 leading-relaxed">
                                    {profile.user.bio || "This user hasn't added a bio yet."}
                                </p>
                            </div>

                            {/* Info Card */}
                            <div className="bg-white dark:bg-dark-lighter rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                                <h3 className="text-lg font-bold mb-4 dark:text-white text-gray-900">Details</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 dark:text-gray-300 text-gray-600">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm dark:text-gray-400 text-gray-500">Joined</p>
                                            <p className="font-medium dark:text-white text-gray-900">
                                                {new Date(profile.user.createdAt).toLocaleDateString('en-US', { 
                                                    month: 'long', day: 'numeric', year: 'numeric' 
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    {profile.user.location && (
                                        <div className="flex items-center gap-3 dark:text-gray-300 text-gray-600">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <MapPin className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm dark:text-gray-400 text-gray-500">Location</p>
                                                <p className="font-medium dark:text-white text-gray-900">{profile.user.location}</p>
                                            </div>
                                        </div>
                                    )}
                                    {profile.user.website && (
                                        <div className="flex items-center gap-3 dark:text-gray-300 text-gray-600">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <LinkIcon className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm dark:text-gray-400 text-gray-500">Website</p>
                                                <a 
                                                    href={profile.user.website} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="font-medium text-primary hover:underline"
                                                >
                                                    {profile.user.website}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Activity Stats */}
                            <div className="bg-white dark:bg-dark-lighter rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                                <h3 className="text-lg font-bold mb-4 dark:text-white text-gray-900">Activity Summary</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-4">
                                        <div className="text-2xl font-bold dark:text-white text-gray-900">{profile.posts?.length || 0}</div>
                                        <div className="text-sm dark:text-gray-400 text-gray-500">Total Posts</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-xl p-4">
                                        <div className="text-2xl font-bold dark:text-white text-gray-900">{totalLikes}</div>
                                        <div className="text-sm dark:text-gray-400 text-gray-500">Total Likes</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl p-4">
                                        <div className="text-2xl font-bold dark:text-white text-gray-900">{profile.user.followers?.length || 0}</div>
                                        <div className="text-sm dark:text-gray-400 text-gray-500">Followers</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4">
                                        <div className="text-2xl font-bold dark:text-white text-gray-900">{profile.user.following?.length || 0}</div>
                                        <div className="text-sm dark:text-gray-400 text-gray-500">Following</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Report Modal */}
            <ConfirmModal
                isOpen={showReportConfirm}
                onClose={() => setShowReportConfirm(false)}
                onConfirm={() => {
                    executeReport();
                    setShowReportConfirm(false);
                }}
                title={`Report ${profile?.user?.username || 'User'}?`}
                message="This will notify administrators. False reports may result in action against your account."
                confirmText="Report"
                cancelText="Cancel"
                type="warning"
            />
        </div>
    );
};

export default ProfileNew;
