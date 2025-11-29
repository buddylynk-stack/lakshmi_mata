import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUnreadMessages } from "../hooks/useUnreadMessages";
import { Home, Search, Users, User, Settings, LogOut, MessageCircle, Bookmark, Sparkles, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
    const { user, logout } = useAuth();
    const { unreadCount: unreadMessagesCount } = useUnreadMessages();
    const navigate = useNavigate();
    const location = useLocation();
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    
    const isOnChatPage = location.pathname === '/chat';
    const showUnreadIndicator = unreadMessagesCount > 0 && !isOnChatPage;
    
    // Hide mobile bottom nav on group/channel detail pages and chat detail pages
    const isOnDetailPage = /^\/groups\/[^/]+$/.test(location.pathname) || 
                           /^\/chat\/[^/]+$/.test(location.pathname) ||
                           /^\/invite\/[^/]+$/.test(location.pathname);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // Handle navigation for non-logged-in users
    const handleNavClick = (e, path) => {
        if (!user && path !== "/") {
            e.preventDefault();
            navigate("/login");
        }
    };

    const navItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: Search, label: "Search", path: "/search" },
        { icon: MessageCircle, label: "Chat", path: "/chat" },
        { icon: Users, label: "Create", path: "/groups" },
        { icon: Bookmark, label: "Saved", path: "/saved" },
        { icon: User, label: "Profile", path: `/profile/${user?.userId}` },
        { icon: Settings, label: "Settings", path: "/settings" },
    ];

    // Mobile bottom nav items (4 main + menu)
    const mobileNavItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: Search, label: "Search", path: "/search" },
        { icon: MessageCircle, label: "Chat", path: "/chat" },
        { icon: Users, label: "Create", path: "/groups" },
    ];

    // Mobile menu items
    const mobileMenuItems = [
        { icon: User, label: "Profile", path: `/profile/${user?.userId}` },
        { icon: Settings, label: "Settings", path: "/settings" },
        { icon: Bookmark, label: "Saved", path: "/saved" },
    ];

    const isActive = (path) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    const handleMenuItemClick = (path) => {
        setShowMobileMenu(false);
        navigate(path);
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 glass-panel m-4 border border-white/10 z-50"
            >
                {/* Logo */}
                <motion.div 
                    className="p-6 border-b dark:border-white/10 border-gray-200"
                    whileHover={{ scale: 1.02 }}
                >
                    <Link to="/" className="flex items-center gap-2">
                        <Sparkles className="w-7 h-7 text-primary" />
                        <h1 className="text-2xl font-bold text-gradient">Buddylynk</h1>
                    </Link>
                </motion.div>

                {/* Navigation Items */}
                <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
                    {navItems.map((item, index) => (
                        <motion.div
                            key={item.path}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Link
                                to={item.path}
                                onClick={(e) => handleNavClick(e, item.path)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                                    isActive(item.path)
                                        ? "bg-gradient-to-r from-primary/20 to-secondary/20 dark:text-white text-gray-900"
                                        : "dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/5 hover:bg-gray-100"
                                }`}
                            >
                                <motion.div 
                                    className="relative"
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <item.icon className={`w-5 h-5 ${isActive(item.path) ? "text-primary" : ""}`} />
                                    {item.label === "Chat" && showUnreadIndicator && (
                                        <motion.span 
                                            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-dark"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500 }}
                                        />
                                    )}
                                </motion.div>
                                <span className="font-medium">{item.label}</span>
                                
                                {isActive(item.path) && (
                                    <motion.div
                                        layoutId="activeIndicator"
                                        className="absolute left-0 w-1 h-8 bg-gradient-to-b from-primary to-secondary rounded-r-full"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                
                                {item.label === "Chat" && showUnreadIndicator && (
                                    <motion.span 
                                        className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 500 }}
                                    >
                                        {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                                    </motion.span>
                                )}
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* Logout/Login Button */}
                <div className="p-4 border-t dark:border-white/10 border-gray-200">
                    {user ? (
                        <motion.button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-3 text-red-500 hover:text-red-400 dark:hover:bg-red-500/10 hover:bg-red-50 rounded-xl w-full transition-all group"
                            whileHover={{ x: 5 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                            <span className="font-medium">Logout</span>
                        </motion.button>
                    ) : (
                        <motion.button
                            onClick={() => navigate("/login")}
                            className="flex items-center gap-3 px-4 py-3 text-primary hover:text-primary/80 dark:hover:bg-primary/10 hover:bg-primary/10 rounded-xl w-full transition-all group"
                            whileHover={{ x: 5 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform rotate-180" />
                            <span className="font-medium">Login / Sign Up</span>
                        </motion.button>
                    )}
                </div>
            </motion.div>

            {/* Mobile Bottom Nav */}
            {/* Mobile Bottom Nav */}
            <motion.div 
                className="md:hidden fixed bottom-0 left-0 right-0 z-50"
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
                <div className="glass-panel border-t dark:border-white/10 border-gray-200 rounded-none px-2 py-2 safe-bottom">
                    <div className="flex justify-around items-center max-w-lg mx-auto">
                        {mobileNavItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={(e) => handleNavClick(e, item.path)}
                                className={`flex flex-col items-center p-2 rounded-xl transition-all relative min-w-[56px] ${
                                    isActive(item.path)
                                        ? "text-primary"
                                        : "dark:text-gray-400 text-gray-500"
                                }`}
                            >
                                <motion.div
                                    whileTap={{ scale: 0.9 }}
                                    className="relative"
                                >
                                    <item.icon className={`w-6 h-6 ${isActive(item.path) ? 'drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]' : ''}`} />
                                    {item.label === "Chat" && showUnreadIndicator && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
                                            {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                                        </span>
                                    )}
                                </motion.div>
                                <span className={`text-[10px] mt-1 font-medium ${isActive(item.path) ? 'text-primary' : ''}`}>
                                    {item.label}
                                </span>
                            </Link>
                        ))}
                        
                        {/* Menu Button (3 lines) */}
                        <button
                            onClick={() => setShowMobileMenu(true)}
                            className={`flex flex-col items-center p-2 rounded-xl transition-all min-w-[56px] ${
                                showMobileMenu ? "text-primary" : "dark:text-gray-400 text-gray-500"
                            }`}
                        >
                            <motion.div whileTap={{ scale: 0.9 }}>
                                <Menu className="w-6 h-6" />
                            </motion.div>
                            <span className="text-[10px] mt-1 font-medium">More</span>
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {showMobileMenu && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMobileMenu(false)}
                            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        />
                        
                        {/* Bottom Sheet Menu */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="md:hidden fixed bottom-0 left-0 right-0 z-[70] glass-panel rounded-t-3xl border-t border-white/20"
                        >
                            {/* Swipe Indicator */}
                            <div className="w-10 h-1 bg-gray-400 rounded-full mx-auto mt-3" />
                            
                            {/* Close Button */}
                            <div className="flex justify-between items-center px-6 py-4 border-b dark:border-white/10 border-gray-200">
                                <h3 className="text-lg font-bold dark:text-white text-gray-900">Menu</h3>
                                <button
                                    onClick={() => setShowMobileMenu(false)}
                                    className="p-2 rounded-full dark:hover:bg-white/10 hover:bg-gray-100"
                                >
                                    <X className="w-5 h-5 dark:text-gray-400 text-gray-600" />
                                </button>
                            </div>
                            
                            {/* Menu Items */}
                            <div className="px-4 py-4 space-y-2">
                                {mobileMenuItems.map((item, index) => (
                                    <motion.button
                                        key={item.path}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        onClick={() => handleMenuItemClick(item.path)}
                                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${
                                            isActive(item.path)
                                                ? "bg-primary/20 text-primary"
                                                : "dark:text-gray-300 text-gray-700 dark:hover:bg-white/10 hover:bg-gray-100"
                                        }`}
                                    >
                                        <item.icon className="w-6 h-6" />
                                        <span className="font-medium text-base">{item.label}</span>
                                    </motion.button>
                                ))}
                            </div>
                            
                            {/* Logout/Login Button - Centered */}
                            <div className="px-4 pb-8 pt-2">
                                {user ? (
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        onClick={() => {
                                            setShowMobileMenu(false);
                                            handleLogout();
                                        }}
                                        className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-red-500/10 text-red-500 rounded-xl font-medium hover:bg-red-500/20 transition-all"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        <span>Logout</span>
                                    </motion.button>
                                ) : (
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        onClick={() => {
                                            setShowMobileMenu(false);
                                            navigate("/login");
                                        }}
                                        className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-all"
                                    >
                                        <LogOut className="w-5 h-5 rotate-180" />
                                        <span>Login / Sign Up</span>
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default Navbar;
