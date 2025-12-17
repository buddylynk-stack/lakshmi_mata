import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

// Shadcn-style Button Component
export const Button = ({
  children,
  variant = "default",
  size = "default",
  isLoading = false,
  disabled = false,
  className = "",
  ...props
}) => {
  const variants = {
    default: "bg-primary text-white hover:bg-primary/90",
    destructive: "bg-red-500 text-white hover:bg-red-600",
    outline: "border border-border dark:border-white/10 bg-transparent hover:bg-accent dark:hover:bg-white/5",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent dark:hover:bg-white/5",
    link: "text-primary underline-offset-4 hover:underline"
  };

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3 text-sm",
    lg: "h-11 px-8",
    icon: "h-10 w-10"
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-medium
        transition-colors focus-visible:outline-none focus-visible:ring-2 
        focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {isLoading && (
        <Loader2 className="w-4 h-4 animate-spin" />
      )}
      {children}
    </motion.button>
  );
};

export default Button;
