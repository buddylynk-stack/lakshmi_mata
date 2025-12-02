// CPU-optimized animation configurations
// Uses only opacity and transform (GPU-accelerated, low CPU usage)
// Minimal durations and simple easing for best performance

// Simple linear easing - lowest CPU usage
export const linearEasing = "linear";
// Ease-out for natural feel with minimal CPU
export const easeOut = "easeOut";

// Container variants - minimal stagger for CPU efficiency
export const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.1,
            staggerChildren: 0.02,
            when: "beforeChildren"
        }
    }
};

// Fast container - no stagger for maximum performance
export const fastContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.1 }
    }
};

// Item variants - opacity only (most CPU efficient)
export const itemVariants = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { duration: 0.12, ease: easeOut }
    }
};

// Fade variants - simplest animation
export const fadeVariants = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { duration: 0.1 }
    }
};

// Scale variants - minimal scale change for CPU efficiency
export const scaleVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { 
        opacity: 1, 
        scale: 1,
        transition: { duration: 0.12, ease: easeOut }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.08 }
    }
};

// Slide variants - small movement for efficiency
export const slideRightVariants = {
    hidden: { opacity: 0, x: 10 },
    visible: { 
        opacity: 1, 
        x: 0,
        transition: { duration: 0.12, ease: easeOut }
    }
};

// Slide up - minimal y movement
export const slideUpVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.15, ease: easeOut }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.08 }
    }
};

// Page variants - fade only
export const pageVariants = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { duration: 0.1 }
    },
    exit: { opacity: 0, transition: { duration: 0.05 } }
};

// Button animations - very subtle for CPU efficiency
export const buttonTap = { scale: 0.99 };
export const buttonHover = { scale: 1.01 };

// Fast transition - for all quick interactions
export const fastTransition = { duration: 0.1, ease: easeOut };

// Default transition
export const defaultTransition = { duration: 0.12, ease: easeOut };

// No animation variant - for when performance is critical
export const noAnimation = {
    hidden: {},
    visible: {},
    exit: {}
};
