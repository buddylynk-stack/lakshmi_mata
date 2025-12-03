import { useState, useEffect, useRef } from "react";

// Retry configuration - reduced to prevent aggressive retrying
const RETRY_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3; // Only retry 3 times

export const SafeAvatar = ({ src, alt, className, fallbackText, username, onClick }) => {
    const [imgSrc, setImgSrc] = useState(src);
    const [retryCount, setRetryCount] = useState(0);
    const [hasLogged, setHasLogged] = useState(false);
    const maxRetries = 1; // Reduced from 2 to 1

    const name = fallbackText || username || alt || 'User';
    const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    useEffect(() => {
        // Reset when src changes
        setImgSrc(src);
        setRetryCount(0);
        setHasLogged(false);
    }, [src]);

    const handleError = (e) => {
        if (retryCount < maxRetries && src) {
            // Retry once with cache-busting
            setRetryCount(prev => prev + 1);
            setImgSrc(`${src}?retry=${Date.now()}`);
        } else {
            // Use fallback after retry exhausted
            if (src && !hasLogged) {
                // Only log once per image to avoid console spam
                console.warn(`⚠️ Avatar failed to load: ${src.substring(0, 80)}...`);
                console.warn(`   Run: node scripts/fix-bucket-permissions.js to fix S3 permissions`);
                setHasLogged(true);
            }
            setImgSrc(fallbackSrc);
        }
    };

    // Use fallback immediately if no src
    const displaySrc = imgSrc || fallbackSrc;

    return (
        <img
            src={displaySrc}
            alt={alt}
            className={className}
            onClick={onClick}
            onError={handleError}
            loading="lazy"
            decoding="async"
        />
    );
};

export const SafeImage = ({ src, alt, className, fallback = null, onClick, loading = "lazy" }) => {
    const [error, setError] = useState(false);

    if (error && !fallback) {
        return null;
    }

    return (
        <img
            src={error && fallback ? fallback : src}
            alt={alt}
            className={className}
            onClick={onClick}
            onError={() => setError(true)}
            loading={loading}
            decoding="async"
            style={error && !fallback ? { display: 'none' } : {}}
        />
    );
};

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

// Advanced image component with retry and auto-delete
export const RetryImage = ({
    src,
    alt,
    className,
    postId = null,
    onDelete = null,
    type = "post", // "post", "group", "banner"
    loading = "lazy", // Add lazy loading support
    onClick
}) => {
    const [imageSrc, setImageSrc] = useState(src);
    const [retryCount, setRetryCount] = useState(0);
    const [isDeleted, setIsDeleted] = useState(false);
    const retryTimerRef = useRef(null);
    const startTimeRef = useRef(Date.now());

    useEffect(() => {
        return () => {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
            }
        };
    }, []);

    const handleImageError = async () => {
        // If we've exceeded max retries, check if it's a 403/404 (deleted from S3)
        if (retryCount >= MAX_RETRIES) {
            console.log(`⚠️ Image failed after ${retryCount} retries: ${src}`);
            
            // Check if the image returns 403 or 404 (deleted from S3)
            try {
                const response = await fetch(src, { method: 'HEAD' });
                if (response.status === 403 || response.status === 404) {
                    console.log(`🗑️ Image deleted from S3 (${response.status}). Auto-deleting post...`);
                    setIsDeleted(true);
                    
                    // If onDelete callback is provided and we have a postId, call it to delete the post
                    if (onDelete && postId) {
                        console.log(`✅ Triggering post deletion for postId: ${postId}`);
                        // Wait a moment before deleting so user sees the message
                        setTimeout(() => {
                            onDelete(postId);
                        }, 2000);
                    }
                    return;
                }
            } catch (error) {
                console.error('Error checking image status:', error);
                // If fetch fails, assume it's deleted
                console.log(`🗑️ Image unreachable. Auto-deleting post...`);
                setIsDeleted(true);
                
                if (onDelete && postId) {
                    setTimeout(() => {
                        onDelete(postId);
                    }, 2000);
                }
                return;
            }
            
            // If not deleted, just hide the image
            setIsDeleted(true);
            return;
        }

        // Retry loading the image
        setRetryCount(prev => prev + 1);
        console.log(`🔄 Retry attempt ${retryCount + 1}/${MAX_RETRIES} for image: ${src}`);

        retryTimerRef.current = setTimeout(() => {
            // Force reload by adding timestamp
            setImageSrc(`${src}?retry=${Date.now()}`);
        }, RETRY_INTERVAL);
    };

    if (isDeleted) {
        return (
            <div className="w-full h-48 flex items-center justify-center bg-gray-800 rounded-xl">
                <div className="text-center text-gray-400">
                    <p className="text-sm">Media no longer available</p>
                    <p className="text-xs mt-1">This file was deleted from storage</p>
                </div>
            </div>
        );
    }

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            loading={loading}
            onClick={onClick}
            onError={handleImageError}
        />
    );
};
