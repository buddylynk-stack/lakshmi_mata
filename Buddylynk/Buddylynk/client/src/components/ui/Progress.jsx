import { motion } from "framer-motion";

// Shadcn-style Progress Bar Component
export const Progress = ({ value = 0, className = "", showLabel = true, variant = "default" }) => {
  const variants = {
    default: "bg-primary",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
    gradient: "bg-gradient-to-r from-primary via-purple-500 to-pink-500"
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/20 dark:bg-white/10">
        <motion.div
          className={`h-full rounded-full ${variants[variant]}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-muted-foreground dark:text-gray-400">{value}%</span>
        </div>
      )}
    </div>
  );
};

export default Progress;
