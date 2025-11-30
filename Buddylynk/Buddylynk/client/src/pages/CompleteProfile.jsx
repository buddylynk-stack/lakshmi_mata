import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, User, FileText, ArrowRight, Upload, Loader2, Sparkles, Check } from "lucide-react";
import axios from "axios";

const CompleteProfile = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: "",
        bio: "",
        avatar: null,
        banner: null
    });
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [bannerPreview, setBannerPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [step, setStep] = useState(1);

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData({ ...formData, avatar: file });
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleBannerChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData({ ...formData, banner: file });
            setBannerPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const token = localStorage.getItem("token");
            const data = new FormData();
            
            if (formData.username) data.append("username", formData.username);
            if (formData.bio) data.append("bio", formData.bio);
            if (formData.avatar) data.append("avatar", formData.avatar);
            if (formData.banner) data.append("banner", formData.banner);

            const res = await axios.put("/api/users", data, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`
                }
            });

            localStorage.setItem("user", JSON.stringify(res.data));
            navigate("/suggested-friends");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update profile");
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
        <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 relative overflow-hidden safe-bottom">
            {/* Animated Background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] sm:w-[50%] h-[50%] bg-primary/30 rounded-full blur-[80px] sm:blur-[120px] animate-float" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] sm:w-[50%] h-[50%] bg-secondary/30 rounded-full blur-[80px] sm:blur-[120px] animate-float" style={{ animationDelay: "3s" }} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="glass-panel p-5 sm:p-8 w-full max-w-2xl relative z-10 border border-white/20 mx-2"
            >
                {/* Header */}
                <motion.div 
                    className="text-center mb-6 sm:mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <motion.div
                        className="inline-flex items-center gap-2 mb-3 sm:mb-4"
                        whileHover={{ scale: 1.05 }}
                    >
                        <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                        <h2 className="text-2xl sm:text-3xl font-bold text-gradient">Complete Your Profile</h2>
                    </motion.div>
                    <p className="text-theme-secondary text-sm sm:text-base">Let's set up your profile to get started</p>
                </motion.div>

                {/* Progress Steps */}
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3].map((s) => (
                        <motion.div
                            key={s}
                            className={`w-16 h-1.5 rounded-full transition-colors ${
                                s <= step ? "bg-gradient-to-r from-primary to-secondary" : "dark:bg-white/10 bg-gray-200"
                            }`}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: s * 0.1 }}
                        />
                    ))}
                </div>

                {/* Error Message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl mb-6 text-sm"
                        >
                            {error}
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
                            <motion.div 
                                className="relative h-32 rounded-xl overflow-hidden border-2 border-dashed dark:border-white/20 border-gray-300 hover:border-primary dark:hover:border-primary transition-colors cursor-pointer group"
                                whileHover={{ scale: 1.01 }}
                            >
                                {bannerPreview ? (
                                    <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full dark:bg-white/5 bg-gray-50 group-hover:bg-primary/5 transition-colors">
                                        <Upload className="w-8 h-8 text-theme-muted group-hover:text-primary transition-colors mb-2" />
                                        <span className="text-sm text-theme-secondary">Click to upload banner</span>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBannerChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                {bannerPreview && (
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-sm">Change banner</span>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>

                        {/* Avatar Upload */}
                        <motion.div variants={itemVariants} className="flex justify-center">
                            <div className="relative">
                                <motion.div 
                                    className="w-32 h-32 rounded-full dark:bg-dark-lighter bg-gray-100 border-4 dark:border-dark border-white overflow-hidden shadow-xl"
                                    whileHover={{ scale: 1.05 }}
                                >
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <Camera className="w-12 h-12 text-theme-muted" />
                                        </div>
                                    )}
                                </motion.div>
                                <motion.label 
                                    className="absolute bottom-0 right-0 p-3 bg-gradient-to-r from-primary to-secondary rounded-full cursor-pointer shadow-lg"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Camera className="w-5 h-5 text-white" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                    />
                                </motion.label>
                            </div>
                        </motion.div>

                        {/* Username */}
                        <motion.div variants={itemVariants} className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-secondary group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Choose a username"
                                className="input-field pl-12"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                required
                            />
                        </motion.div>

                        {/* Bio */}
                        <motion.div variants={itemVariants} className="relative group">
                            <FileText className="absolute left-4 top-4 w-5 h-5 text-theme-secondary group-focus-within:text-primary transition-colors" />
                            <textarea
                                placeholder="Tell us about yourself..."
                                className="input-field pl-12 min-h-[100px] resize-none"
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                maxLength={150}
                            />
                            <div className="text-right text-xs text-theme-muted mt-1">
                                {formData.bio.length}/150
                            </div>
                        </motion.div>

                        {/* Submit Button */}
                        <motion.button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 group h-12"
                            variants={itemVariants}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <span>Continue</span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </motion.div>
                </form>

                {/* Skip Button */}
                <motion.div 
                    className="mt-6 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <button
                        onClick={() => navigate("/suggested-friends")}
                        className="text-theme-secondary hover:text-primary transition-colors text-sm"
                    >
                        Skip for now
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default CompleteProfile;
