// INSTANT animations - no slow loading, everything appears immediately
// Uses GPU-accelerated properties: opacity, transform

// Check if mobile for adaptive animations
const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

// Fast easing curves
export const linearEasing = "linear";
export const easeOut = [0.25, 0.1, 0.25, 1];
export const easeInOut = [0.42, 0, 0.58, 1];
export const easeOutSoft = [0.16, 1, 0.3, 1];
export const easeOutGentle = [0.33, 1, 0.68, 1];
export const spring = { type: "spring", stiffness: 400, damping: 40, mass: 0.5 };
export const springGentle = { type: "spring", stiffness: 300, damping: 35, mass: 0.5 };
export const springSoft = { type: "spring", stiffness: 250, damping: 30, mass: 0.5 };

// Container variants - INSTANT, no stagger delay
export const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.1,
            staggerChildren: 0.01,
            when: "beforeChildren",
            ease: linearEasing
        }
    }
};

// Fast container - INSTANT
export const fastContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { 
            duration: 0.05,
            staggerChildren: 0,
            ease: linearEasing
        }
    }
};

// Item variants - INSTANT appear
export const itemVariants = {
    hidden: { 
        opacity: 0, 
        y: 0
    },
    visible: { 
        opacity: 1,
        y: 0,
        transition: { 
            duration: 0.1, 
            ease: linearEasing 
        }
    }
};

// Fade variants - INSTANT
export const fadeVariants = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { duration: 0.1, ease: linearEasing }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

// Scale variants - INSTANT
export const scaleVariants = {
    hidden: { 
        opacity: 0, 
        scale: 1
    },
    visible: { 
        opacity: 1, 
        scale: 1,
        transition: { 
            duration: 0.1, 
            ease: linearEasing 
        }
    },
    exit: {
        opacity: 0,
        scale: 1,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

// Slide right - INSTANT
export const slideRightVariants = {
    hidden: { opacity: 0, x: 0 },
    visible: { 
        opacity: 1, 
        x: 0,
        transition: { duration: 0.1, ease: linearEasing }
    },
    exit: {
        opacity: 0,
        x: 0,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

// Slide up - INSTANT
export const slideUpVariants = {
    hidden: { opacity: 0, y: 0 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    },
    exit: {
        opacity: 0,
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

// Slide down - INSTANT
export const slideDownVariants = {
    hidden: { opacity: 0, y: 0 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    },
    exit: {
        opacity: 0,
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

// Page variants - INSTANT
export const pageVariants = {
    hidden: { opacity: 0, y: 0 },
    visible: { 
        opacity: 1,
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    },
    exit: { 
        opacity: 0, 
        y: 0,
        transition: { duration: 0.1, ease: linearEasing } 
    }
};

// Modal variants - INSTANT
export const modalVariants = {
    hidden: { opacity: 0, scale: 1, y: 0 },
    visible: { 
        opacity: 1, 
        scale: 1,
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    },
    exit: {
        opacity: 0,
        scale: 1,
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

// Overlay variants - for modal backgrounds
export const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { duration: 0.2, ease: easeOut }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.15, ease: easeOut }
    }
};

// Button animations - soft tap feedback
export const buttonTap = { scale: 0.98 };
export const buttonHover = { scale: 1.01 };

// Card hover - subtle lift effect
export const cardHover = {
    y: -2,
    transition: { duration: 0.2, ease: easeOutSoft }
};

// Fast transition - INSTANT
export const fastTransition = { 
    duration: 0.05, 
    ease: linearEasing 
};

// Default transition - INSTANT
export const defaultTransition = { 
    duration: 0.1, 
    ease: linearEasing 
};

// Smooth transition - INSTANT
export const smoothTransition = {
    duration: 0.1,
    ease: linearEasing
};

// Soft transition - INSTANT
export const softTransition = {
    duration: 0.1,
    ease: linearEasing
};

// Spring transitions for natural feel
export const springTransition = springGentle;
export const springSoftTransition = springSoft;

// No animation variant - for when performance is critical
export const noAnimation = {
    hidden: {},
    visible: {},
    exit: {}
};

// List item stagger - for smooth list animations
export const listStagger = {
    visible: {
        transition: {
            staggerChildren: isMobile ? 0.03 : 0.05
        }
    }
};

// Message bubble animation - INSTANT
export const messageBubbleVariants = {
    hidden: { opacity: 0, scale: 1, y: 0 },
    visible: { 
        opacity: 1, 
        scale: 1,
        y: 0,
        transition: { duration: 0.05, ease: linearEasing }
    }
};

// Notification pop - INSTANT
export const notificationVariants = {
    hidden: { opacity: 0, scale: 1, y: 0 },
    visible: { 
        opacity: 1, 
        scale: 1,
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    },
    exit: {
        opacity: 0,
        scale: 1,
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

// Mobile-specific - INSTANT
export const mobileSlideUp = {
    hidden: { opacity: 0, y: 0 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

export const mobileFadeIn = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { duration: 0.1, ease: linearEasing }
    }
};

export const mobileScaleIn = {
    hidden: { opacity: 0, scale: 1 },
    visible: { 
        opacity: 1, 
        scale: 1,
        transition: { duration: 0.1, ease: linearEasing }
    }
};
