import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { Users, ArrowLeft, Loader2, X, Mail, Lock, Eye, EyeOff, Sparkles, User } from "lucide-react";
import { SafeImage } from "../components/SafeImage";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";

const InviteJoin = () => {
    const { inviteCode } = useParams();
    const { user, login, signup } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState(null);

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


    // Main Join Screen - Simple channel info with Join button (for both logged-in non-members and guests)
    return (
        <div className="fixed inset-0 flex flex-col dark:bg-[#0b141a] bg-gray-100">
            {/* Header */}
            <div className="dark:bg-[#202c33] bg-white px-4 py-3 flex items-center gap-3 border-b dark:border-[#2a3942] border-gray-200">
                <button onClick={() => navigate("/")} className="dark:text-[#aebac1] text-gray-600 p-1">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-lg font-medium dark:text-white text-gray-900">Join Channel</h2>
            </div>

            {/* Channel Info */}
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

            {/* Login Modal - shown when guest clicks Join */}
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
                                        {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLoginMode ? "Sign In" : "Create Account"}
                                    </button>
                                </form>
                                <div className="my-4 flex items-center gap-3">
                                    <div className="flex-1 h-px dark:bg-[#2a3942] bg-gray-300"></div>
                                    <span className="dark:text-[#8696a0] text-gray-500 text-sm">or</span>
                                    <div className="flex-1 h-px dark:bg-[#2a3942] bg-gray-300"></div>
                                </div>
                                <div className="flex justify-center">
                                    <GoogleLogin onSuccess={handleGoogleLogin} onError={() => setLoginError("Google login failed")} />
                                </div>
                                <p className="text-center mt-4 dark:text-[#8696a0] text-gray-600 text-sm">
                                    {isLoginMode ? "Don't have an account?" : "Already have an account?"}{" "}
                                    <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-[#00a884] font-semibold">
                                        {isLoginMode ? "Sign Up" : "Sign In"}
                                    </button>
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default InviteJoin;
