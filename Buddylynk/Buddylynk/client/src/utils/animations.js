// Soft, buttery smooth animations optimized for mobile
// Uses GPU-accelerated properties: opacity, transform

// Check if mobile for adaptive animations
const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

// Soft easing curves - gentler than standard
export const linearEasing = "linear";
export const easeOut = [0.25, 0.1, 0.25, 1]; // Softer ease-out
export const easeInOut = [0.42, 0, 0.58, 1]; // Gentle ease-in-out
export const easeOutSoft = [0.16, 1, 0.3, 1]; // Very soft, natural feel
export const easeOutGentle = [0.33, 1, 0.68, 1]; // Extra gentle
export const spring = { type: "spring", stiffness: 200, damping: 30, mass: 1 };
export const springGentle = { type: "spring", stiffness: 150, damping: 25, mass: 0.8 };
export const springSoft = { type: "spring", stiffness: 100, damping: 20, mass: 0.5 };

// Container variants - soft stagger
export const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: isMobile ? 0.25 : 0.3,
            staggerChildren: isMobile ? 0.04 : 0.06,
            when: "beforeChildren",
            ease: easeOutSoft
        }
    }
};

// Fast container - minimal stagger
export const fastContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { 
            duration: 0.2,
            staggerChildren: 0.03,
            ease: easeOutSoft
        }
    }
};

// Item variants - soft fade with subtle movement
export const itemVariants = {
    hidden: { 
        opacity: 0, 
        y: isMobile ? 6 : 10
    },
    visible: { 
        opacity: 1,
        y: 0,
        transition: { 
            duration: isMobile ? 0.25 : 0.3, 
            ease: easeOutSoft 
        }
    }
};

// Fade variants - simple and soft
export const fadeVariants = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { duration: isMobile ? 0.2 : 0.25, ease: easeOutSoft }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.15, ease: easeOut }
    }
};

// Scale variants - soft scale
export const scaleVariants = {
    hidden: { 
        opacity: 0, 
        scale: 0.97
    },
    visible: { 
        opacity: 1, 
        scale: 1,
        transition: { 
            duration: isMobile ? 0.2 : 0.25, 
            ease: easeOutSoft 
        }
    },
    exit: {
        opacity: 0,
        scale: 0.98,
        transition: { duration: 0.15, ease: easeOut }
    }
};

// Slide right - soft horizontal slide
export const slideRightVariants = {
    hidden: { 
        opacity: 0, 
        x: isMobile ? 10 : 15 
    },
    visible: { 
        opacity: 1, 
        x: 0,
        transition: { 
            duration: isMobile ? 0.25 : 0.3, 
            ease: easeOutSoft 
        }
    },
    exit: {
        opacity: 0,
        x: -8,
        transition: { duration: 0.15, ease: easeOut }
    }
};

// Slide up - soft vertical slide
export const slideUpVariants = {
    hidden: { 
        opacity: 0, 
        y: isMobile ? 10 : 15 
    },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { 
            duration: isMobile ? 0.25 : 0.3, 
            ease: easeOutSoft 
        }
    },
    exit: {
        opacity: 0,
        y: 8,
        transition: { duration: 0.15, ease: easeOut }
    }
};

// Slide down - for dropdowns/menus
export const slideDownVariants = {
    hidden: { 
        opacity: 0, 
        y: -8
    },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { 
            duration: 0.2, 
            ease: easeOutSoft 
        }
    },
    exit: {
        opacity: 0,
        y: -5,
        transition: { duration: 0.15, ease: easeOut }
    }
};

// Page variants - soft page transitions
export const pageVariants = {
    hidden: { 
        opacity: 0,
        y: 8
    },
    visible: { 
        opacity: 1,
        y: 0,
        transition: { 
            duration: 0.25, 
            ease: easeOutSoft 
        }
    },
    exit: { 
        opacity: 0, 
        y: -5,
        transition: { duration: 0.15, ease: easeOut } 
    }
};

// Modal variants - soft modal animations
export const modalVariants = {
    hidden: { 
        opacity: 0, 
        scale: 0.95,
        y: 10
    },
    visible: { 
        opacity: 1, 
        scale: 1,
        y: 0,
        transition: { 
            duration: 0.25, 
            ease: easeOutSoft 
        }
    },
    exit: {
        opacity: 0,
        scale: 0.97,
        y: 5,
        transition: { duration: 0.2, ease: easeOut }
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

// Fast transition - for quick interactions
export const fastTransition = { 
    duration: isMobile ? 0.15 : 0.2, 
    ease: easeOutSoft 
};

// Default transition
export const defaultTransition = { 
    duration: isMobile ? 0.2 : 0.25, 
    ease: easeOutSoft 
};

// Smooth transition - for important animations
export const smoothTransition = {
    duration: 0.3,
    ease: easeOutSoft
};

// Soft transition - extra gentle
export const softTransition = {
    duration: 0.35,
    ease: easeOutGentle
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

// Message bubble animation - for chat (softer)
export const messageBubbleVariants = {
    hidden: { 
        opacity: 0, 
        scale: 0.95,
        y: 8
    },
    visible: { 
        opacity: 1, 
        scale: 1,
        y: 0,
        transition: { 
            duration: 0.2, 
            ease: easeOutSoft 
        }
    }
};

// Notification pop - soft attention
export const notificationVariants = {
    hidden: { 
        opacity: 0, 
        scale: 0.9,
        y: -15
    },
    visible: { 
        opacity: 1, 
        scale: 1,
        y: 0,
        transition: { 
            duration: 0.3, 
            ease: easeOutSoft 
        }
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: -8,
        transition: { duration: 0.2, ease: easeOut }
    }
};

// Mobile-specific soft animations
export const mobileSlideUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.3, ease: easeOutGentle }
    }
};

export const mobileFadeIn = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { duration: 0.25, ease: easeOutSoft }
    }
};

export const mobileScaleIn = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { 
        opacity: 1, 
        scale: 1,
        transition: { duration: 0.25, ease: easeOutSoft }
    }
};
