import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, Sparkles } from "lucide-react";
import { GoogleLogin } from '@react-oauth/google';
import { useToast } from "../context/ToastContext";
import { scaleVariants, fadeVariants, fastTransition } from "../utils/animations";

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ username: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const { login, signup } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // Check if terms are accepted for signup
        if (!isLogin && !acceptedTerms) {
            toast.error("Please accept the Terms and Conditions to create an account", 4000);
            return;
        }

        setLoading(true);
        
        let res;
        if (isLogin) {
            res = await login(formData.email, formData.password);
        } else {
            res = await signup(formData.username, formData.email, formData.password);
        }

        setLoading(false);
        
        if (res.success) {
            if (res.isNewUser || !isLogin) {
                toast.success("Welcome buddy! Glad to see you 🎉", 4000);
                navigate("/complete-profile");
            } else {
                toast.success("Welcome back buddy! 👋", 4000);
                navigate("/");
            }
        } else {
            setError(res.message);
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
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="glass-panel p-6 sm:p-8 w-full max-w-md relative z-10 border border-white/20 mx-2"
            >
                {/* Logo/Brand */}
                <motion.div 
                    className="text-center mb-6 sm:mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <motion.div
                        className="inline-flex items-center gap-2 mb-3 sm:mb-4"
                        whileHover={{ scale: 1.05 }}
                    >
                        <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-gradient">Buddylynk</h1>
                    </motion.div>
                    <h2 className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900 mb-2">
                        {isLogin ? "Welcome Back" : "Join Buddylynk"}
                    </h2>
                    <p className="text-theme-secondary text-sm sm:text-base">
                        {isLogin ? "Enter your credentials to continue" : "Connect with friends and share moments"}
                    </p>
                </motion.div>

                {/* Error Message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl mb-6 text-sm font-medium flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <span>{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Form */}
                <motion.form 
                    onSubmit={handleSubmit} 
                    className="space-y-4"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <AnimatePresence mode="wait">
                        {!isLogin && (
                            <motion.div
                                key="username"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        className="input-field pl-12"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        required={!isLogin}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.div variants={itemVariants} className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="email"
                            placeholder="Email"
                            className="input-field pl-12"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </motion.div>

                    <motion.div variants={itemVariants} className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            className="input-field pl-12 pr-12"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </motion.div>

                    {/* Terms and Conditions Checkbox - Only for Signup */}
                    <AnimatePresence mode="wait">
                        {!isLogin && (
                            <motion.div
                                key="terms"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-start gap-3"
                            >
                                <input
                                    type="checkbox"
                                    id="terms"
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    required
                                />
                                <label htmlFor="terms" className="text-sm dark:text-gray-300 text-gray-600 cursor-pointer">
                                    I have read and agree to the{" "}
                                    <a 
                                        href="/terms-of-service.html" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Terms and Conditions
                                    </a>
                                    {" "}and{" "}
                                    <a 
                                        href="/privacy-policy.html" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Privacy Policy
                                    </a>
                                </label>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button 
                        type="submit" 
                        className="btn-primary w-full flex items-center justify-center gap-2 group h-12"
                        variants={itemVariants}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={loading || (!isLogin && !acceptedTerms)}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Please wait...</span>
                            </>
                        ) : (
                            <>
                                <span>{isLogin ? "Sign In" : "Create Account"}</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </motion.button>
                </motion.form>

                {/* Divider */}
                <motion.div 
                    className="relative my-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t dark:border-white/10 border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="px-4 text-sm dark:bg-dark-lighter bg-white dark:text-gray-400 text-gray-500">
                            Or continue with
                        </span>
                    </div>
                </motion.div>

                {/* Google Login */}
                <motion.div 
                    className="flex justify-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <GoogleLogin
                        onSuccess={async (credentialResponse) => {
                            try {
                                setLoading(true);
                                const response = await fetch('/api/auth/google', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ credential: credentialResponse.credential })
                                });
                                const data = await response.json();
                                if (data.token) {
                                    localStorage.setItem('token', data.token);
                                    localStorage.setItem('user', JSON.stringify(data.user));
                                    if (data.isNewUser) {
                                        toast.success("Welcome buddy! Glad to see you 🎉", 4000);
                                        navigate('/complete-profile');
                                    } else {
                                        toast.success("Welcome back buddy! 👋", 4000);
                                        navigate('/');
                                    }
                                    window.location.reload();
                                }
                            } catch (error) {
                                setError('Google login failed');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        onError={() => setError('Google login failed')}
                        theme="outline"
                        size="large"
                        text="continue_with"
                        shape="rectangular"
                        logo_alignment="left"
                    />
                </motion.div>

                {/* Toggle Login/Signup */}
                <motion.div 
                    className="mt-8 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError("");
                        }}
                        className="text-theme-secondary hover:text-primary transition-colors text-sm group"
                    >
                        {isLogin ? (
                            <>Don't have an account? <span className="text-primary font-semibold group-hover:underline">Sign Up</span></>
                        ) : (
                            <>Already have an account? <span className="text-primary font-semibold group-hover:underline">Sign In</span></>
                        )}
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default Login;
