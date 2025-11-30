import { useState, useEffect } from "react";
import axios from "axios";
import { Search as SearchIcon, X, Clock, UserPlus, Loader2, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SafeAvatar } from "../components/SafeImage";

const Search = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState({ users: [], posts: [] });
    const [recentSearches, setRecentSearches] = useState([]);
    const [recommendedUsers, setRecommendedUsers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [userAvatars, setUserAvatars] = useState({});

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        setRecentSearches(saved);
        fetchRecommendedUsers();
    }, []);

    useEffect(() => {
        if (results.posts && results.posts.length > 0) {
            fetchUserAvatars();
        }
    }, [results]);

    const fetchUserAvatars = async () => {
        try {
            const userIds = [...new Set(results.posts.map(post => post.userId))];
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

    const fetchRecommendedUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("/api/users/all", {
                headers: { Authorization: `Bearer ${token}` }
            });

            const filtered = res.data
                .filter(u => u.userId !== user.userId)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

            setRecommendedUsers(filtered);
        } catch (error) {
            console.error("Error fetching recommended users:", error);
        }
    };

    const handleSearch = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const res = await axios.get(`/api/search?q=${query}`);
            setResults(res.data);
            saveRecentSearch(query);
        } catch (error) {
            console.error("Search error:", error);
            setResults({ users: [], posts: [] });
        } finally {
            setLoading(false);
        }
    };

    const saveRecentSearch = (searchQuery) => {
        let recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        recent = recent.filter(s => s !== searchQuery);
        recent.unshift(searchQuery);
        recent = recent.slice(0, 10);
        localStorage.setItem('recentSearches', JSON.stringify(recent));
        setRecentSearches(recent);
    };

    const handleRecentSearchClick = async (searchQuery) => {
        setQuery(searchQuery);
        setLoading(true);
        try {
            const res = await axios.get(`/api/search?q=${searchQuery}`);
            setResults(res.data);
        } catch (error) {
            console.error("Search error:", error);
            setResults({ users: [], posts: [] });
        } finally {
            setLoading(false);
        }
    };

    const clearRecentSearch = (searchQuery) => {
        const updated = recentSearches.filter(s => s !== searchQuery);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
        setRecentSearches(updated);
    };

    const clearAllRecentSearches = () => {
        localStorage.removeItem('recentSearches');
        setRecentSearches([]);
    };

    const handleQueryChange = async (e) => {
        const value = e.target.value;
        setQuery(value);

        if (value.trim().length > 0) {
            try {
                const token = localStorage.getItem("token");
                const res = await axios.get(`/api/search/suggestions?q=${value}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSuggestions(res.data);
                setShowSuggestions(true);
            } catch (error) {
                console.error("Error fetching suggestions:", error);
                setSuggestions([]);
            }
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setQuery(suggestion.username);
        setShowSuggestions(false);
        navigate(`/profile/${suggestion.userId}`);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen md:pl-72 pt-4 pb-24 md:pb-4 md:pr-4 dark:bg-dark bg-gray-100">
            <div className="max-w-7xl mx-auto px-3 sm:px-4">
                <div className="flex gap-4 sm:gap-6">
                    {/* Main Search Area */}
                    <div className="flex-1 space-y-4 sm:space-y-6">
                        {/* Search Bar */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-panel p-4 relative"
                        >
                            <form onSubmit={handleSearch} className="relative">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-secondary" />
                                <input
                                    type="text"
                                    placeholder="Search users, posts..."
                                    className="input-field pl-12 pr-12"
                                    value={query}
                                    onChange={handleQueryChange}
                                    onFocus={() => query.trim() && setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                />
                                {query && (
                                    <motion.button
                                        type="button"
                                        onClick={() => {
                                            setQuery("");
                                            setResults({ users: [], posts: [] });
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-primary"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.button>
                                )}
                            </form>

                            {/* Autocomplete Suggestions */}
                            <AnimatePresence>
                                {showSuggestions && suggestions.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl shadow-2xl border dark:border-white/10 border-gray-200 overflow-hidden z-50 mx-4"
                                    >
                                        {suggestions.map((suggestion, index) => (
                                            <motion.button
                                                key={suggestion.userId}
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                className="w-full flex items-center gap-3 p-3 dark:hover:bg-white/5 hover:bg-gray-100 transition-colors text-left"
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.03 }}
                                            >
                                                <SearchIcon className="w-4 h-4 text-theme-secondary" />
                                                <SafeAvatar
                                                    src={suggestion.avatar}
                                                    alt={suggestion.username}
                                                    fallbackText={suggestion.username}
                                                    className="w-8 h-8 rounded-full"
                                                />
                                                <div className="flex-1">
                                                    <p className="font-medium dark:text-white text-gray-900">{suggestion.username}</p>
                                                    {suggestion.bio && (
                                                        <p className="text-xs text-theme-secondary truncate">{suggestion.bio}</p>
                                                    )}
                                                </div>
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* Search Results */}
                        {loading ? (
                            <div className="glass-panel p-12 text-center">
                                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                                <p className="text-theme-secondary">Searching...</p>
                            </div>
                        ) : (
                            <motion.div 
                                className="space-y-6"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {results.users.length > 0 && (
                                    <motion.div variants={itemVariants} className="glass-panel p-6">
                                        <h3 className="text-lg font-bold mb-4 text-gradient flex items-center gap-2">
                                            <UserPlus className="w-5 h-5 text-primary" />
                                            Users
                                        </h3>
                                        <div className="space-y-2">
                                            {results.users.map((searchUser, index) => (
                                                <motion.div
                                                    key={searchUser.userId}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                >
                                                    <Link
                                                        to={`/profile/${searchUser.userId}`}
                                                        className="flex items-center gap-3 p-3 rounded-xl dark:hover:bg-white/5 hover:bg-gray-100 transition-all group"
                                                    >
                                                        <SafeAvatar
                                                            src={searchUser.avatar}
                                                            alt={searchUser.username}
                                                            fallbackText={searchUser.username}
                                                            className="w-12 h-12 rounded-full group-hover:ring-2 group-hover:ring-primary transition-all"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="font-semibold dark:text-white text-gray-900 group-hover:text-primary transition-colors">
                                                                {searchUser.username}
                                                            </p>
                                                            {searchUser.bio && (
                                                                <p className="text-sm text-theme-secondary truncate">{searchUser.bio}</p>
                                                            )}
                                                        </div>
                                                    </Link>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {results.posts.length > 0 && (
                                    <motion.div variants={itemVariants} className="glass-panel p-6">
                                        <h3 className="text-lg font-bold mb-4 text-gradient flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-secondary" />
                                            Posts
                                        </h3>
                                        <div className="space-y-4">
                                            {results.posts.map((post, index) => (
                                                <motion.div 
                                                    key={post.postId} 
                                                    className="p-4 rounded-xl dark:bg-white/5 bg-gray-50 hover:dark:bg-white/10 hover:bg-gray-100 transition-all cursor-pointer"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    whileHover={{ scale: 1.01 }}
                                                    onClick={() => navigate(`/post/${post.postId}`)}
                                                >
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <SafeAvatar
                                                            src={userAvatars[post.userId] || post.userAvatar}
                                                            alt={post.username}
                                                            fallbackText={post.username}
                                                            className="w-8 h-8 rounded-full"
                                                        />
                                                        <span className="font-medium dark:text-white text-gray-900">{post.username}</span>
                                                    </div>
                                                    <p className="text-theme-secondary line-clamp-2">{post.content}</p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {query && results.users.length === 0 && results.posts.length === 0 && !loading && (
                                    <motion.div 
                                        variants={itemVariants}
                                        className="glass-panel p-12 text-center"
                                    >
                                        <SearchIcon className="w-16 h-16 text-theme-muted mx-auto mb-4" />
                                        <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-2">No results found</h3>
                                        <p className="text-theme-secondary">Try searching for something else</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block w-80 space-y-6">
                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-panel p-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold dark:text-white text-gray-900 flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-primary" />
                                        Recent
                                    </h3>
                                    <button
                                        onClick={clearAllRecentSearches}
                                        className="text-xs text-theme-secondary hover:text-primary transition-colors"
                                    >
                                        Clear all
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {recentSearches.map((search, index) => (
                                        <motion.div
                                            key={index}
                                            className="flex items-center justify-between p-2 rounded-lg dark:hover:bg-white/5 hover:bg-gray-100 transition-colors group"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                        >
                                            <button
                                                onClick={() => handleRecentSearchClick(search)}
                                                className="flex-1 text-left text-theme-secondary text-sm hover:text-primary transition-colors"
                                            >
                                                {search}
                                            </button>
                                            <motion.button
                                                onClick={() => clearRecentSearch(search)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                <X className="w-4 h-4 text-theme-muted hover:text-red-500" />
                                            </motion.button>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Recommended Users */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass-panel p-6"
                        >
                            <h3 className="font-bold dark:text-white text-gray-900 mb-4 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-primary" />
                                New Users
                            </h3>
                            <div className="space-y-3">
                                {recommendedUsers.map((recUser, index) => (
                                    <motion.div 
                                        key={recUser.userId} 
                                        className="flex items-center gap-3 group cursor-pointer"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => navigate(`/profile/${recUser.userId}`)}
                                        whileHover={{ x: 5 }}
                                    >
                                        <SafeAvatar
                                            src={recUser.avatar}
                                            alt={recUser.username}
                                            fallbackText={recUser.username}
                                            className="w-10 h-10 rounded-full group-hover:ring-2 group-hover:ring-primary transition-all"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium dark:text-white text-gray-900 group-hover:text-primary transition-colors truncate">
                                                {recUser.username}
                                            </p>
                                            {recUser.bio && (
                                                <p className="text-xs text-theme-secondary truncate">
                                                    {recUser.bio}
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Search;
