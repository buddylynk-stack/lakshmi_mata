import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle2, Loader2, Shield, Save } from "lucide-react";
import Progress from "./Progress";

// Shadcn-style Upload Progress Component
export const UploadProgress = ({ 
  isUploading, 
  progress = 0, 
  isSuccess = false,
  stage = "uploading" // uploading, checking, saving, complete
}) => {
  const getStageInfo = () => {
    if (isSuccess) {
      return {
        icon: CheckCircle2,
        text: "Post created successfully!",
        color: "text-green-500",
        variant: "success"
      };
    }
    
    switch (stage) {
      case "uploading":
        return {
          icon: Upload,
          text: "Uploading media...",
          color: "text-primary",
          variant: "gradient"
        };
      case "checking":
        return {
          icon: Shield,
          text: "Checking content safety...",
          color: "text-yellow-500",
          variant: "warning"
        };
      case "saving":
        return {
          icon: Save,
          text: "Saving post...",
          color: "text-purple-500",
          variant: "default"
        };
      default:
        return {
          icon: Loader2,
          text: "Processing...",
          color: "text-primary",
          variant: "default"
        };
    }
  };

  const stageInfo = getStageInfo();
  const Icon = stageInfo.icon;

  return (
    <AnimatePresence>
      {isUploading && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 16 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-border/50 dark:border-white/10 bg-card/50 dark:bg-white/5 backdrop-blur-sm p-4 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${isSuccess ? 'bg-green-500/10' : 'bg-primary/10'}`}>
                <Icon className={`w-5 h-5 ${stageInfo.color} ${!isSuccess && stage !== "complete" ? 'animate-pulse' : ''}`} />
              </div>
              <div className="flex-1">
                <p className={`font-medium ${stageInfo.color}`}>
                  {stageInfo.text}
                </p>
                <p className="text-xs text-muted-foreground dark:text-gray-500">
                  {isSuccess ? "Your post is now live!" : "Please wait..."}
                </p>
              </div>
              <span className={`text-lg font-bold ${stageInfo.color}`}>
                {progress}%
              </span>
            </div>

            {/* Progress Bar */}
            <Progress 
              value={progress} 
              variant={stageInfo.variant}
              showLabel={false}
            />

            {/* Stage Indicators */}
            <div className="flex justify-between mt-3 px-1">
              {["Upload", "Check", "Save", "Done"].map((label, index) => {
                const stageProgress = [0, 80, 90, 100];
                const isActive = progress >= stageProgress[index];
                const isCurrent = progress >= stageProgress[index] && progress < (stageProgress[index + 1] || 101);
                
                return (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <motion.div
                      className={`w-2 h-2 rounded-full ${
                        isActive 
                          ? isSuccess ? 'bg-green-500' : 'bg-primary' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      animate={isCurrent && !isSuccess ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                    <span className={`text-[10px] ${
                      isActive 
                        ? 'text-foreground dark:text-white' 
                        : 'text-muted-foreground dark:text-gray-500'
                    }`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadProgress;
