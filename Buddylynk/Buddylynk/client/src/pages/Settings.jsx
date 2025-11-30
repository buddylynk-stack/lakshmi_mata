import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, UserX, X, Lock, Eye, EyeOff, Shield, Palette, Bell, ChevronRight, Check } from "lucide-react";
import { SafeAvatar } from "../components/SafeImage";
import axios from "axios";

const Settings = () => {
    const { theme, toggleTheme } = useTheme();
    const { user, updateUser } = useAuth();
    const { socket, on, off } = useSocket();
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");

    useEffect(() => {
        fetchBlockedUsers();
    }, [user]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleUserUpdated = (data) => {
            if (data.userId === user.userId) {
                if (data.action === 'block' || data.action === 'unblock') {
                    fetchBlockedUsers();
                }
                if (data.user) {
                    updateUser(data.user);
                }
            }
        };

        on("userUpdated", handleUserUpdated);
        return () => off("userUpdated", handleUserUpdated);
    }, [socket, on, off, user, updateUser]);

    const fetchBlockedUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("/api/users/blocked/list", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBlockedUsers(res.data.blockedUsers);
        } catch (error) {
            console.error("Error fetching blocked users:", error);
        }
    };

    const handleUnblock = async (targetUserId) => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            await axios.post("/api/users/unblock", 
                { targetUserId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setBlockedUsers(blockedUsers.filter(u => u.userId !== targetUserId));
        } catch (error) {
            console.error("Error unblocking user:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError("All fields are required");
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            await axios.post("/api/users/change-password", 
                { currentPassword, newPassword },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPasswordSuccess("Password changed successfully!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => {
                setShowPasswordForm(false);
                setPasswordSuccess("");
            }, 2000);
        } catch (error) {
            setPasswordError(error.response?.data?.message || "Error changing password");
        } finally {
            setLoading(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen md:pl-72 pt-4 pb-24 md:pb-4 md:pr-4 dark:bg-dark bg-gray-100">
            <div className="max-w-2xl mx-auto px-3 sm:px-4">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4 sm:space-y-6"
                >
                    {/* Header */}
                    <motion.div variants={itemVariants}>
                        <h1 className="text-2xl sm:text-3xl font-bold dark:text-white text-gray-900 mb-2">Settings</h1>
                        <p className="text-theme-secondary text-sm sm:text-base">Manage your account preferences</p>
                    </motion.div>

                    {/* Appearance Section */}
                    <motion.div variants={itemVariants} className="glass-panel p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-primary/20">
                                <Palette className="w-5 h-5 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold dark:text-white text-gray-900">Appearance</h2>
                        </div>

                        <motion.button
                            onClick={toggleTheme}
                            className="w-full flex items-center justify-between p-4 rounded-xl dark:bg-white/5 bg-gray-50 dark:hover:bg-white/10 hover:bg-gray-100 transition-all group"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                        >
                            <div className="flex items-center gap-4">
                                <motion.div
                                    className={`p-3 rounded-xl ${theme === "dark" ? "bg-violet-500/20" : "bg-yellow-500/20"}`}
                                    animate={{ rotate: theme === "dark" ? 0 : 180 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {theme === "dark" ? (
                                        <Moon className="w-5 h-5 text-violet-500" />
                                    ) : (
                                        <Sun className="w-5 h-5 text-yellow-500" />
                                    )}
                                </motion.div>
                                <div className="text-left">
                                    <p className="font-medium dark:text-white text-gray-900">Theme</p>
                                    <p className="text-sm text-theme-secondary">
                                        {theme === "dark" ? "Dark Mode" : "Light Mode"}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-theme-secondary group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                    </motion.div>

                    {/* Security Section */}
                    <motion.div variants={itemVariants} className="glass-panel p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-green-500/20">
                                <Shield className="w-5 h-5 text-green-500" />
                            </div>
                            <h2 className="text-xl font-bold dark:text-white text-gray-900">Security</h2>
                        </div>

                        <AnimatePresence mode="wait">
                            {!showPasswordForm ? (
                                <motion.button
                                    key="password-button"
                                    onClick={() => setShowPasswordForm(true)}
                                    className="w-full flex items-center justify-between p-4 rounded-xl dark:bg-white/5 bg-gray-50 dark:hover:bg-white/10 hover:bg-gray-100 transition-all group"
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-xl bg-primary/20">
                                            <Lock className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium dark:text-white text-gray-900">Change Password</p>
                                            <p className="text-sm text-theme-secondary">Update your password</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-theme-secondary group-hover:translate-x-1 transition-transform" />
                                </motion.button>
                            ) : (
                                <motion.form
                                    key="password-form"
                                    onSubmit={handleChangePassword}
                                    className="space-y-4"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    <div>
                                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                                            Current Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showCurrentPassword ? "text" : "password"}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="input-field pr-12"
                                                placeholder="Enter current password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-primary transition-colors"
                                            >
                                                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="input-field pr-12"
                                                placeholder="Min 6 characters"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-primary transition-colors"
                                            >
                                                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-theme-secondary mb-2">
                                            Confirm New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="input-field"
                                            placeholder="Confirm new password"
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {passwordError && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm"
                                            >
                                                {passwordError}
                                            </motion.div>
                                        )}
                                        {passwordSuccess && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-500 text-sm flex items-center gap-2"
                                            >
                                                <Check className="w-4 h-4" />
                                                {passwordSuccess}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="flex gap-3 justify-end pt-2">
                                        <motion.button
                                            type="button"
                                            onClick={() => {
                                                setShowPasswordForm(false);
                                                setCurrentPassword("");
                                                setNewPassword("");
                                                setConfirmPassword("");
                                                setPasswordError("");
                                            }}
                                            className="btn-ghost"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            Cancel
                                        </motion.button>
                                        <motion.button
                                            type="submit"
                                            disabled={loading}
                                            className="btn-primary"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            {loading ? "Saving..." : "Update Password"}
                                        </motion.button>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Blocked Users Section */}
                    <motion.div variants={itemVariants} className="glass-panel p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-red-500/20">
                                <UserX className="w-5 h-5 text-red-500" />
                            </div>
                            <h2 className="text-xl font-bold dark:text-white text-gray-900">Blocked Users</h2>
                        </div>

                        {blockedUsers.length === 0 ? (
                            <div className="text-center py-8">
                                <UserX className="w-12 h-12 text-theme-muted mx-auto mb-3" />
                                <p className="text-theme-secondary">No blocked users</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {blockedUsers.map((blockedUser, index) => (
                                    <motion.div
                                        key={blockedUser.userId}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-center justify-between p-4 rounded-xl dark:bg-white/5 bg-gray-50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <SafeAvatar
                                                src={blockedUser.avatar}
                                                alt={blockedUser.username}
                                                fallbackText={blockedUser.username}
                                                className="w-12 h-12 rounded-full"
                                            />
                                            <div>
                                                <h3 className="font-semibold dark:text-white text-gray-900">
                                                    {blockedUser.username}
                                                </h3>
                                                {blockedUser.bio && (
                                                    <p className="text-sm text-theme-secondary truncate max-w-[200px]">
                                                        {blockedUser.bio}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <motion.button
                                            onClick={() => handleUnblock(blockedUser.userId)}
                                            disabled={loading}
                                            className="btn-danger text-sm px-4 py-2"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            Unblock
                                        </motion.button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* Version Section */}
                    <motion.div variants={itemVariants} className="text-center py-6">
                        <p className="text-theme-secondary text-sm">Version</p>
                        <p className="text-lg font-semibold dark:text-white text-gray-900">Budy 2.8</p>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};

export default Settings;
