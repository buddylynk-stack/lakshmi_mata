import { useSingleUserOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Online Indicator Component - Optimized for performance
 */
export const OnlineIndicator = ({ 
    userId, 
    size = 'md', 
    showOffline = true,
    className = '' 
}) => {
    const { isOnline, loading } = useSingleUserOnlineStatus(userId);

    if (loading) return null;
    if (!isOnline && !showOffline) return null;

    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4'
    };

    return (
        <div 
            className={`${sizeClasses[size]} rounded-full ${
                isOnline 
                    ? 'bg-green-500 ring-2 ring-white dark:ring-slate-800' 
                    : 'bg-gray-400'
            } ${className}`}
            title={isOnline ? 'Online' : 'Offline'}
        />
    );
};

/**
 * Online Badge Component
 */
export const OnlineBadge = ({ userId, className = '' }) => {
    const { isOnline, loading } = useSingleUserOnlineStatus(userId);

    if (loading) return null;

    return (
        <span 
            className={`text-xs px-2 py-0.5 rounded-full ${
                isOnline 
                    ? 'bg-green-500/20 text-green-500' 
                    : 'bg-gray-500/20 text-gray-500'
            } ${className}`}
        >
            {isOnline ? 'Online' : 'Offline'}
        </span>
    );
};

/**
 * Avatar with Online Indicator
 */
export const AvatarWithStatus = ({ 
    children, 
    userId, 
    indicatorSize = 'md',
    indicatorPosition = 'bottom-right'
}) => {
    const positionClasses = {
        'bottom-right': 'bottom-0 right-0',
        'top-right': 'top-0 right-0',
        'bottom-left': 'bottom-0 left-0',
        'top-left': 'top-0 left-0'
    };

    return (
        <div className="relative inline-block">
            {children}
            <div className={`absolute ${positionClasses[indicatorPosition]}`}>
                <OnlineIndicator userId={userId} size={indicatorSize} />
            </div>
        </div>
    );
};

export default OnlineIndicator;
