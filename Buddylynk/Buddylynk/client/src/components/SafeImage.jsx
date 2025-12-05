import { useState, useEffect, useRef, memo } from "react";

// Retry configuration - INSTANT, no delays
const RETRY_INTERVAL = 100; // Reduced from 5000ms
const MAX_RETRIES = 1; // Reduced from 2

export const SafeAvatar = memo(({ src, alt, className, fallbackText, username, onClick }) => {
    const [imgSrc, setImgSrc] = useState(src);
    const [retryCount, setRetryCount] = useState(0);
    const [hasLogged, setHasLogged] = useState(false);
    const maxRetries = 1;

    const name = fallbackText || username || alt || 'User';
    const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=64`;

    useEffect(() => {
        setImgSrc(src);
        setRetryCount(0);
        setHasLogged(false);
    }, [src]);

    const handleError = () => {
        if (retryCount < maxRetries && src) {
            setRetryCount(prev => prev + 1);
            setImgSrc(`${src}?retry=${Date.now()}`);
        } else {
            if (src && !hasLogged) {
                console.warn(`⚠️ Avatar failed: ${src.substring(0, 50)}...`);
                setHasLogged(true);
            }
            setImgSrc(fallbackSrc);
        }
    };

    const displaySrc = imgSrc || fallbackSrc;

    return (
        <img
            src={displaySrc}
            alt={alt}
            className={className}
            onClick={onClick}
            onError={handleError}
            decoding="async"
        />
    );
});

SafeAvatar.displayName = 'SafeAvatar';

export const SafeImage = memo(({ src, alt, className, fallback = null, onClick, style }) => {
    const [error, setError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    // Reset error state when src changes
    useEffect(() => {
        setError(false);
        setRetryCount(0);
    }, [src]);

    const handleError = () => {
        // Retry once with cache-busting
        if (retryCount < 1 && src) {
            setRetryCount(prev => prev + 1);
            return;
        }
        console.warn(`⚠️ Image failed to load: ${src?.substring(0, 60)}...`);
        setError(true);
    };

    // Show placeholder when image fails to load
    if (error) {
        if (fallback) {
            return (
                <img
                    src={fallback}
                    alt={alt}
                    className={className}
                    onClick={onClick}
                    decoding="async"
                    style={style}
                />
            );
        }
        // Show error placeholder instead of hiding
        return (
            <div 
                className={`flex items-center justify-center bg-gray-800/50 rounded-lg ${className}`}
                style={{ ...style, minHeight: '100px' }}
                onClick={onClick}
            >
                <div className="text-center text-gray-400 p-4">
                    <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs">Image unavailable</p>
                </div>
            </div>
        );
    }

    // Add retry parameter to URL if retrying
    const imgSrc = retryCount > 0 ? `${src}?retry=${retryCount}` : src;

    return (
        <img
            src={imgSrc}
            alt={alt}
            className={className}
            onClick={onClick}
            onError={handleError}
            decoding="async"
            style={style}
        />
    );
});

SafeImage.displayName = 'SafeImage';

export const SafeBanner = ({ src, alt, className }) => {
    const [error, setError] = useState(false);

    if (error) {
        return <div className="w-full h-full bg-gradient-to-r from-primary/20 to-secondary/20" />;
    }

    return src ? (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setError(true)}
        />
    ) : (
        <div className="w-full h-full bg-gradient-to-r from-primary/20 to-secondary/20" />
    );
};

// Image component with retry and auto-delete - NO lazy loading
export const RetryImage = memo(({
    src,
    alt,
    className,
    postId = null,
    onDelete = null,
    onClick,
    style
}) => {
    const [imageSrc, setImageSrc] = useState(src);
    const [retryCount, setRetryCount] = useState(0);
    const [isDeleted, setIsDeleted] = useState(false);
    const retryTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
            }
        };
    }, []);

    const handleImageError = async () => {
        if (retryCount >= MAX_RETRIES) {
            try {
                const response = await fetch(src, { method: 'HEAD' });
                if (response.status === 403 || response.status === 404) {
                    setIsDeleted(true);
                    if (onDelete && postId) {
                        setTimeout(() => onDelete(postId), 2000);
                    }
                    return;
                }
            } catch {
                setIsDeleted(true);
                if (onDelete && postId) {
                    setTimeout(() => onDelete(postId), 2000);
                }
                return;
            }
            setIsDeleted(true);
            return;
        }

        setRetryCount(prev => prev + 1);
        retryTimerRef.current = setTimeout(() => {
            setImageSrc(`${src}?retry=${Date.now()}`);
        }, RETRY_INTERVAL);
    };

    if (isDeleted) {
        return (
            <div className="w-full h-48 flex items-center justify-center bg-gray-800 rounded-xl">
                <div className="text-center text-gray-400">
                    <p className="text-sm">Media no longer available</p>
                </div>
            </div>
        );
    }

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            decoding="async"
            onClick={onClick}
            onError={handleImageError}
            style={style}
        />
    );
});

RetryImage.displayName = 'RetryImage';
