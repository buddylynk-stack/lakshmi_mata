import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { Users, ArrowLeft, Loader2, X, Mail, Lock, Eye, EyeOff, Sparkles, User, Info } from "lucide-react";
import { SafeImage } from "../components/SafeImage";
import { GoogleLogin } from "@react-oauth/google";
import VideoPlayer from "../components/VideoPlayer";
import axios from "axios";

const InviteJoin = () => {
    const { inviteCode } = useParams();
    const { user, login, signup } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [group, setGroup] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState(null);
    const [showChannelInfo, setShowChannelInfo] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState(null);

    // Login modal state
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ username: "", email: "", password: "" });

    useEffect(() => {
        fetchGroupByInvite();
    }, [inviteCode]);

    const fetchGroupByInvite = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`/api/groups/invite/${inviteCode}`);
            setGroup(res.data);
            // Fetch posts for preview
            if (res.data.posts) {
                setPosts(res.data.posts);
            }
        } catch (error) {
            console.error("Error fetching group:", error);
            if (error.response?.status === 404) {
                setError("This invite link is invalid or has expired.");
            } else {
                setError("Failed to load channel information.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!user) {
            setShowLoginModal(true);
            return;
        }
        await joinChannel();
    };

    const joinChannel = async () => {
        setJoining(true);
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/groups/invite/${inviteCode}/join`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Joined ${group.name}!`);
            navigate(`/groups/${group.groupId}`);
        } catch (error) {
            if (error.response?.data?.message === "Already a member") {
                toast.info("You're already a member");
                navigate(`/groups/${group.groupId}`);
            } else {
                toast.error(error.response?.data?.message || "Failed to join");
            }
        } finally {
            setJoining(false);
        }
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoginError("");
        setLoginLoading(true);

        let res;
        if (isLoginMode) {
            res = await login(formData.email, formData.password);
        } else {
            res = await signup(formData.username, formData.email, formData.password);
        }

        setLoginLoading(false);

        if (res.success) {
            toast.success(isLoginMode ? "Welcome back buddy! 👋" : "Welcome buddy! Glad to see you 🎉", 4000);
            setShowLoginModal(false);
            setTimeout(() => joinChannel(), 500);
        } else {
            setLoginError(res.message);
        }
    };

    const handleGoogleLogin = async (credentialResponse) => {
        try {
            setLoginLoading(true);
            const response = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: credentialResponse.credential })
            });
            const data = await response.json();
            if (data.token) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));
                toast.success(data.isNewUser ? "Welcome buddy! 🎉" : "Welcome back buddy! 👋", 4000);
                setShowLoginModal(false);
                window.location.reload();
            }
        } catch {
            setLoginError("Google login failed");
        } finally {
            setLoginLoading(false);
        }
    };

    const formatTime = (date) => {
        if (!date) return "";
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now - d) / 86400000);
        if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center dark:bg-[#0b141a] bg-gray-100">
                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center dark:bg-[#0b141a] bg-gray-100 p-4">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <Users className="w-10 h-10 text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold dark:text-white text-gray-900 mb-2">Invalid Invite Link</h2>
                    <p className="dark:text-gray-400 text-gray-600 mb-6">{error}</p>
                    <button onClick={() => navigate("/")} className="px-6 py-3 bg-[#00a884] text-white font-medium rounded-xl">
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    const isMember = user && group?.members?.includes(user.userId);

    // For logged-in users who are already members, redirect to channel
    if (isMember) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center dark:bg-[#0b141a] bg-gray-100 p-4">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                        <Users className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-xl font-semibold dark:text-white text-gray-900 mb-2">You're already a member!</h2>
                    <button onClick={() => navigate(`/groups/${group.groupId}`)} className="px-6 py-3 bg-[#00a884] text-white font-medium rounded-xl mt-4">
                        Open Channel
                    </button>
                </div>
            </div>
        );
    }

    // For logged-in users who are NOT members, show join screen
    if (user && !isMember) {
        return (
            <div className="fixed inset-0 flex flex-col dark:bg-[#0b141a] bg-gray-100">
                <div className="dark:bg-[#202c33] bg-white px-4 py-3 flex items-center gap-3 border-b dark:border-[#2a3942] border-gray-200">
                    <button onClick={() => navigate(-1)} className="dark:text-[#aebac1] text-gray-600 p-1">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h2 className="text-lg font-medium dark:text-white text-gray-900">Join Channel</h2>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-sm w-full text-center">
                        <div className="w-32 h-32 rounded-full overflow-hidden mx-auto mb-5 ring-4 dark:ring-[#2a3942] ring-gray-300">
                            {group?.coverImage ? (
                                <SafeImage src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[#00a884] to-[#25d366] flex items-center justify-center">
                                    <Users className="w-16 h-16 text-white" />
                                </div>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">{group?.name}</h1>
                        <p className="dark:text-[#8696a0] text-gray-500 text-sm mb-4">
                            {group?.memberCount || 0} members
                        </p>
                        {group?.description && <p className="dark:text-gray-400 text-gray-600 text-sm mb-6">{group.description}</p>}
                        <button onClick={handleJoin} disabled={joining} className="w-full py-3.5 bg-[#00a884] text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                            {joining ? <><Loader2 className="w-5 h-5 animate-spin" /> Joining...</> : <><Users className="w-5 h-5" /> Join Channel</>}
                        </button>
                    </motion.div>
                </div>
            </div>
        );
    }

    // For NON-logged-in users: Show full channel preview like Telegram
    return (
        <div className="fixed inset-0 flex flex-col dark:bg-[#0b141a] bg-gray-100">
            {/* Header */}
            <div className="dark:bg-[#202c33] bg-white px-4 py-3 flex items-center gap-3 border-b dark:border-[#2a3942] border-gray-200">
                <button onClick={() => navigate("/")} className="dark:text-[#aebac1] text-gray-600 p-1">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setShowChannelInfo(true)}>
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                        {group?.coverImage ? (
                            <SafeImage src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#00a884] to-[#25d366] flex items-center justify-center">
                                <Users className="w-5 h-5 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold dark:text-white text-gray-900 truncate">{group?.name}</h2>
                        <p className="text-xs dark:text-[#8696a0] text-gray-500">{group?.memberCount || 0} members</p>
                    </div>
                </div>
                <button onClick={() => setShowChannelInfo(true)} className="dark:text-[#aebac1] text-gray-600 p-2">
                    <Info className="w-5 h-5" />
                </button>
            </div>

            {/* Messages/Posts Preview */}
            <div className="flex-1 overflow-y-auto dark:bg-[#0b141a] bg-[#efeae2] pb-32 md:pb-20">
                {posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <Users className="w-16 h-16 dark:text-[#8696a0] text-gray-400 mb-4" />
                        <p className="dark:text-[#8696a0] text-gray-600">No posts yet</p>
                        <p className="dark:text-[#8696a0] text-gray-500 text-sm mt-1">Join to be the first to post!</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {posts.slice(0, 20).map((post) => (
                            <div key={post.postId} className="dark:bg-[#202c33] bg-white rounded-xl p-3 shadow-sm max-w-[85%] ml-auto">
                                {/* Post Content */}
                                {post.content && (
                                    <p className="dark:text-[#e9edef] text-gray-900 text-sm whitespace-pre-wrap mb-2">
                                        {post.content}
                                    </p>
                                )}

                                {/* Media - Real Frame Layout like WhatsApp/Telegram */}
                                {post.media && post.media.length > 0 && (
                                    <div className="mb-2 rounded-xl overflow-hidden border dark:border-[#2a3942] border-gray-200 bg-black/5 dark:bg-black/20">
                                        {post.media.length === 1 ? (
                                            // Single image - full natural aspect ratio with frame
                                            <div className="flex justify-center p-1">
                                                {post.media[0].type === "video" ? (
                                                    <VideoPlayer src={post.media[0].url} className="max-w-full max-h-[300px] rounded-lg" />
                                                ) : (
                                                    <SafeImage 
                                                        src={post.media[0].url} 
                                                        alt="" 
                                                        onClick={() => setFullScreenImage(post.media[0].url)}
                                                        className="max-w-full max-h-[300px] w-auto h-auto object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity" 
                                                    />
                                                )}
                                            </div>
                                        ) : post.media.length === 2 ? (
                                            // 2 images - side by side with frame
                                            <div className="flex gap-1 p-1">
                                                {post.media.map((mediaItem, idx) => (
                                                    <div key={idx} className="flex-1 flex justify-center">
                                                        {mediaItem.type === "video" ? (
                                                            <VideoPlayer src={mediaItem.url} className="max-w-full max-h-[200px] rounded-lg" />
                                                        ) : (
                                                            <SafeImage 
                                                                src={mediaItem.url} 
                                                                alt="" 
                                                                onClick={() => setFullScreenImage(mediaItem.url)}
                                                                className="max-w-full max-h-[200px] w-auto h-auto object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity" 
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            // 3+ images - grid layout with frame
                                            <div className="flex flex-col gap-1 p-1">
                                                <div className="flex justify-center">
                                                    {post.media[0].type === "video" ? (
                                                        <VideoPlayer src={post.media[0].url} className="max-w-full max-h-[250px] rounded-lg" />
                                                    ) : (
                                                        <SafeImage 
                                                            src={post.media[0].url} 
                                                            alt="" 
                                                            onClick={() => setFullScreenImage(post.media[0].url)}
                                                            className="max-w-full max-h-[250px] w-auto h-auto object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity" 
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1 justify-center">
                                                    {post.media.slice(1).map((mediaItem, idx) => (
                                                        <div key={idx} className="flex justify-center" style={{ maxWidth: post.media.length <= 3 ? "48%" : "32%" }}>
                                                            {mediaItem.type === "video" ? (
                                                                <VideoPlayer src={mediaItem.url} className="max-w-full max-h-[150px] rounded-lg" />
                                                            ) : (
                                                                <SafeImage 
                                                                    src={mediaItem.url} 
                                                                    alt="" 
                                                                    onClick={() => setFullScreenImage(mediaItem.url)}
                                                                    className="max-w-full max-h-[150px] w-auto h-auto object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity" 
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Time */}
                                <div className="flex justify-end">
                                    <span className="text-[10px] dark:text-[#8696a0] text-gray-500">
                                        {formatTime(post.createdAt)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Join Bar at Bottom - Above mobile nav */}
            <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 dark:bg-[#202c33] bg-white border-t dark:border-[#2a3942] border-gray-200 px-4 py-3">
                <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full py-3.5 bg-[#00a884] hover:bg-[#06cf9c] text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                >
                    {joining ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Joining...</>
                    ) : (
                        <><Users className="w-5 h-5" /> Join Channel</>
                    )}
                </button>
            </div>

            {/* Channel Info Modal */}
            <AnimatePresence>
                {showChannelInfo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowChannelInfo(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="dark:bg-[#202c33] bg-white rounded-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 ring-4 dark:ring-[#2a3942] ring-gray-200">
                                    {group?.coverImage ? (
                                        <SafeImage src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-[#00a884] to-[#25d366] flex items-center justify-center">
                                            <Users className="w-12 h-12 text-white" />
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-xl font-bold dark:text-white text-gray-900 mb-1">{group?.name}</h2>
                                <p className="dark:text-[#8696a0] text-gray-500 text-sm mb-3">
                                    {group?.type === "channel" ? "Channel" : "Group"} · {group?.memberCount || 0} members
                                </p>
                                {group?.description && (
                                    <p className="dark:text-gray-400 text-gray-600 text-sm mb-4">{group.description}</p>
                                )}
                                <p className="dark:text-[#8696a0] text-gray-500 text-xs">
                                    Created by {group?.creatorName || "Unknown"}
                                </p>
                            </div>
                            <div className="px-6 pb-6">
                                <button
                                    onClick={() => { setShowChannelInfo(false); handleJoin(); }}
                                    className="w-full py-3 bg-[#00a884] text-white font-semibold rounded-xl"
                                >
                                    Join Channel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Login Modal */}
            <AnimatePresence>
                {showLoginModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowLoginModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="dark:bg-[#202c33] bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
                        >
                            <div className="px-6 py-4 border-b dark:border-[#2a3942] border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-6 h-6 text-primary" />
                                    <h2 className="text-xl font-bold dark:text-white text-gray-900">
                                        {isLoginMode ? "Sign In" : "Create Account"}
                                    </h2>
                                </div>
                                <button onClick={() => setShowLoginModal(false)} className="dark:text-[#8696a0] text-gray-500 p-1">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6">
                                <p className="dark:text-[#8696a0] text-gray-600 text-sm mb-6 text-center">
                                    {isLoginMode ? "Sign in to join" : "Create an account to join"}{" "}
                                    <span className="font-semibold dark:text-white text-gray-900">{group?.name}</span>
                                </p>
                                {loginError && (
                                    <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl mb-4 text-sm">
                                        {loginError}
                                    </div>
                                )}
                                <form onSubmit={handleLoginSubmit} className="space-y-4">
                                    {!isLoginMode && (
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Username"
                                                className="w-full pl-12 pr-4 py-3 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 rounded-xl focus:outline-none border dark:border-transparent border-gray-300"
                                                value={formData.username}
                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                required={!isLoginMode}
                                            />
                                        </div>
                                    )}
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            className="w-full pl-12 pr-4 py-3 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 rounded-xl focus:outline-none border dark:border-transparent border-gray-300"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 dark:text-[#8696a0] text-gray-400" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password"
                                            className="w-full pl-12 pr-12 py-3 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 rounded-xl focus:outline-none border dark:border-transparent border-gray-300"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 dark:text-[#8696a0] text-gray-400">
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    <button type="submit" disabled={loginLoading} className="w-full py-3 bg-[#00a884] text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                                        {loginLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Please wait...</> : isLoginMode ? "Sign In & Join" : "Create Account & Join"}
                                    </button>
                                </form>
                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t dark:border-[#2a3942] border-gray-200"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="px-4 text-sm dark:bg-[#202c33] bg-white dark:text-[#8696a0] text-gray-500">Or</span>
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <GoogleLogin onSuccess={handleGoogleLogin} onError={() => setLoginError("Google login failed")} theme="outline" size="large" text="continue_with" shape="rectangular" />
                                </div>
                                <p className="text-center mt-6 dark:text-[#8696a0] text-gray-600 text-sm">
                                    {isLoginMode ? "Don't have an account? " : "Already have an account? "}
                                    <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setLoginError(""); }} className="text-primary font-semibold hover:underline">
                                        {isLoginMode ? "Sign Up" : "Sign In"}
                                    </button>
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Fullscreen Image Modal */}
            <AnimatePresence>
                {fullScreenImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4"
                        onClick={() => setFullScreenImage(null)}
                    >
                        <button
                            onClick={() => setFullScreenImage(null)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={fullScreenImage}
                            alt="Full screen view"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default InviteJoin;
