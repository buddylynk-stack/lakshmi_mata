import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, UserPlus, ArrowRight, Check, Loader2, Users, Sparkles } from "lucide-react";
import axios from "axios";
import { SafeAvatar } from "../components/SafeImage";

const SuggestedFriends = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [followedUsers, setFollowedUsers] = useState(new Set());
    const [followingInProgress, setFollowingInProgress] = useState(new Set());

    useEffect(() => {
        fetchSuggestedUsers();
    }, []);

    useEffect(() => {
        if (searchQuery.trim()) {
            const filtered = users.filter(user =>
                user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers(users);
        }
    }, [searchQuery, users]);

    const fetchSuggestedUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("/api/users/all", {
                headers: { Authorization: `Bearer ${token}` }
            });

            const shuffled = res.data.sort(() => 0.5 - Math.random());
            const suggested = shuffled.slice(0, 10);
            setUsers(suggested);
            setFilteredUsers(suggested);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (userId) => {
        setFollowingInProgress(prev => new Set([...prev, userId]));
        
        try {
            const token = localStorage.getItem("token");
            await axios.post("/api/users/follow", 
                { targetUserId: userId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setFollowedUsers(prev => new Set([...prev, userId]));
        } catch (error) {
            console.error("Failed to follow user:", error);
        } finally {
            setFollowingInProgress(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    };

    const handleFinish = () => {
        navigate("/");
    };

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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-theme-secondary">Finding people for you...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-3 sm:p-4 relative overflow-hidden pb-24 sm:pb-8">
            {/* Animated Background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] sm:w-[50%] h-[50%] bg-primary/30 rounded-full blur-[80px] sm:blur-[120px] animate-float" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] sm:w-[50%] h-[50%] bg-secondary/30 rounded-full blur-[80px] sm:blur-[120px] animate-float" style={{ animationDelay: "3s" }} />
            </div>

            <div className="max-w-4xl mx-auto pt-4 sm:pt-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-6 sm:mb-8"
                >
                    <motion.div
                        className="inline-flex items-center gap-2 mb-3 sm:mb-4"
                        whileHover={{ scale: 1.05 }}
                    >
                        <Users className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                        <h2 className="text-2xl sm:text-3xl font-bold text-gradient">Find Your Friends</h2>
                    </motion.div>
                    <p className="text-theme-secondary text-sm sm:text-base">
                        Follow people to see their posts in your feed
                    </p>
                    
                    {/* Follow Count Badge */}
                    <AnimatePresence>
                        {followedUsers.size > 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-500"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span className="font-medium">Following {followedUsers.size} {followedUsers.size === 1 ? 'person' : 'people'}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-6"
                >
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-secondary group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="input-field pl-12"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </motion.div>

                {/* User Grid */}
                {filteredUsers.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel p-8 sm:p-12 text-center"
                    >
                        <Users className="w-12 h-12 sm:w-16 sm:h-16 text-theme-muted mx-auto mb-4" />
                        <h3 className="text-lg sm:text-xl font-semibold dark:text-white text-gray-900 mb-2">No users found</h3>
                        <p className="text-theme-secondary text-sm sm:text-base">Try a different search term</p>
                    </motion.div>
                ) : (
                    <motion.div
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {filteredUsers.map((user) => (
                            <motion.div
                                key={user.userId}
                                variants={itemVariants}
                                className="glass-panel p-4 hover:border-primary/30 transition-all group"
                                whileHover={{ y: -2, scale: 1.01 }}
                            >
                                <div className="flex items-center gap-4">
                                    <motion.div
                                        whileHover={{ scale: 1.1 }}
                                        transition={{ type: "spring", stiffness: 400 }}
                                    >
                                        <SafeAvatar
                                            src={user.avatar}
                                            alt={user.username}
                                            fallbackText={user.username}
                                            className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all"
                                        />
                                    </motion.div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold dark:text-white text-gray-900 truncate group-hover:text-primary transition-colors">
                                            {user.username}
                                        </h3>
                                        {user.bio && (
                                            <p className="text-sm text-theme-secondary mt-1 line-clamp-2">
                                                {user.bio}
                                            </p>
                                        )}
                                    </div>
                                    <motion.button
                                        onClick={() => handleFollow(user.userId)}
                                        disabled={followedUsers.has(user.userId) || followingInProgress.has(user.userId)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                                            followedUsers.has(user.userId)
                                                ? "bg-green-500/20 text-green-500 cursor-default"
                                                : "btn-primary"
                                        }`}
                                        whileHover={!followedUsers.has(user.userId) ? { scale: 1.05 } : {}}
                                        whileTap={!followedUsers.has(user.userId) ? { scale: 0.95 } : {}}
                                    >
                                        {followingInProgress.has(user.userId) ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : followedUsers.has(user.userId) ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                <span>Following</span>
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus className="w-4 h-4" />
                                                <span>Follow</span>
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                {/* Finish Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex justify-center"
                >
                    <motion.button
                        onClick={handleFinish}
                        className="btn-primary flex items-center gap-2 group px-8 h-12"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <span>{followedUsers.size > 0 ? "Get Started" : "Skip & Continue"}</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                </motion.div>
            </div>
        </div>
    );
};

export default SuggestedFriends;
