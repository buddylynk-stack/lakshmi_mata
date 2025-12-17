import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Upload, ArrowLeft, Loader2, Check, Camera, User, FileText } from "lucide-react";
import { SafeAvatar, SafeImage } from "../components/SafeImage";

const EditProfile = () => {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: user?.username || "",
        bio: user?.bio || "",
    });
    const [avatar, setAvatar] = useState(null);
    const [banner, setBanner] = useState(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        
        const data = new FormData();
        data.append("username", formData.username);
        data.append("bio", formData.bio);
        if (avatar) data.append("avatar", avatar);
        if (banner) data.append("banner", banner);

        try {
            const token = localStorage.getItem("token");
            const response = await axios.put("/api/users", data, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    "Authorization": `Bearer ${token}`
                },
            });

            if (response.data) {
                updateUser(response.data);
            }

            setMessage("Profile updated successfully!");
            setAvatar(null);
            setBanner(null);

            setTimeout(() => {
                navigate(`/profile/${user.userId}`);
            }, 1500);
        } catch (error) {
            setMessage(error.response?.data?.error || "Failed to update profile");
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-5 sm:p-8 border border-white/10"
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                        <motion.button
                            onClick={() => navigate(`/profile/${user.userId}`)}
                            className="btn-icon"
                            whileHover={{ scale: 1.1, x: -3 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                        </motion.button>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900">Edit Profile</h2>
                            <p className="text-theme-secondary text-xs sm:text-sm">Update your profile information</p>
                        </div>
                    </div>

                    {/* Message */}
                    <AnimatePresence>
                        {message && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${
                                    message.includes("success") 
                                        ? "bg-green-500/10 border border-green-500/30 text-green-500" 
                                        : "bg-red-500/10 border border-red-500/30 text-red-500"
                                }`}
                            >
                                {message.includes("success") && <Check className="w-5 h-5" />}
                                {message}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit}>
                        <motion.div 
                            className="space-y-6"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            {/* Banner Upload */}
                            <motion.div variants={itemVariants}>
                                <label className="block text-sm font-medium text-theme-secondary mb-2">
                                    Banner Image
                                </label>
                                <div className="relative group">
                                    <motion.div 
                                        className="w-full h-32 rounded-xl overflow-hidden bg-gradient-to-r from-primary/20 to-secondary/20"
                                        whileHover={{ scale: 1.01 }}
                                    >
                                        {banner ? (
                                            <img
                                                src={URL.createObjectURL(banner)}
                                                alt="Banner preview"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : user?.banner ? (
                                            <SafeImage
                                                src={user.banner}
                                                alt="Current banner"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Upload className="w-8 h-8 text-theme-muted" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-white text-sm">Change banner</span>
                                        </div>
                                    </motion.div>
                                    <motion.label 
                                        className="absolute bottom-3 right-3 btn-primary py-2 px-4 cursor-pointer flex items-center gap-2 text-sm"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Upload className="w-4 h-4" />
                                        Change
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => setBanner(e.target.files[0])}
                                        />
                                    </motion.label>
                                </div>
                            </motion.div>

                            {/* Avatar Upload */}
                            <motion.div variants={itemVariants}>
                                <label className="block text-sm font-medium text-theme-secondary mb-2">
                                    Profile Picture
                                </label>
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            className="relative"
                                        >
                                            <SafeAvatar
                                                src={avatar ? URL.createObjectURL(avatar) : user?.avatar}
                                                alt="Avatar"
                                                fallbackText={user?.username || 'User'}
                                                className="w-24 h-24 rounded-full object-cover ring-4 ring-primary/20"
                                            />
                                        </motion.div>
                                        <motion.label 
                                            className="absolute bottom-0 right-0 p-2 bg-gradient-to-r from-primary to-secondary rounded-full cursor-pointer shadow-lg"
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <Camera className="w-4 h-4 text-white" />
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => setAvatar(e.target.files[0])}
                                            />
                                        </motion.label>
                                    </div>
                                    <div className="text-sm text-theme-secondary">
                                        <p>Upload a new profile picture</p>
                                        <p className="text-xs text-theme-muted mt-1">JPG, PNG or GIF. Max 5MB</p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Username */}
                            <motion.div variants={itemVariants}>
                                <label className="block text-sm font-medium text-theme-secondary mb-2">
                                    Username
                                </label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-secondary group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        className="input-field pl-12"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="Your username"
                                    />
                                </div>
                            </motion.div>

                            {/* Bio */}
                            <motion.div variants={itemVariants}>
                                <label className="block text-sm font-medium text-theme-secondary mb-2">
                                    Bio
                                </label>
                                <div className="relative group">
                                    <FileText className="absolute left-4 top-4 w-5 h-5 text-theme-secondary group-focus-within:text-primary transition-colors" />
                                    <textarea
                                        className="input-field pl-12 min-h-[120px] resize-none"
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        placeholder="Tell us about yourself..."
                                        maxLength={150}
                                    />
                                </div>
                                <div className="text-right text-xs text-theme-muted mt-1">
                                    {formData.bio.length}/150
                                </div>
                            </motion.div>

                            {/* Submit Button */}
                            <motion.button 
                                type="submit" 
                                className="btn-primary w-full flex items-center justify-center gap-2 h-12"
                                variants={itemVariants}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        <span>Save Changes</span>
                                    </>
                                )}
                            </motion.button>
                        </motion.div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
};

export default EditProfile;
