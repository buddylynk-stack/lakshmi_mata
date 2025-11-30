/**
 * Cleanup old localStorage data that's no longer needed
 * Run this once to remove deprecated keys
 */
export const cleanupOldStorage = () => {
    // Remove old viewedPosts tracking (now handled server-side)
    localStorage.removeItem('viewedPosts');
    
    console.log('✅ Cleaned up old localStorage data');
};

/**
 * Get current localStorage usage info
 */
export const getStorageInfo = () => {
    const keys = Object.keys(localStorage);
    const info = {};
    
    keys.forEach(key => {
        const value = localStorage.getItem(key);
        info[key] = {
            size: new Blob([value]).size,
            preview: value.substring(0, 50) + (value.length > 50 ? '...' : '')
        };
    });
    
    return info;
};

/**
 * Clear all app data (useful for logout or debugging)
 */
export const clearAllAppData = () => {
    const keysToKeep = ['theme']; // Keep theme preference
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
        if (!keysToKeep.includes(key)) {
            localStorage.removeItem(key);
        }
    });
    
    console.log('✅ Cleared all app data (kept theme)');
};
