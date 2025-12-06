import { useState, useEffect } from 'react';

// Cache HLS URLs to avoid repeated API calls
const hlsCache = new Map();

// Unified CloudFront domain (serves both images and HLS)
const CLOUDFRONT_DOMAIN = 'd1urwintyo9xhn.cloudfront.net';

/**
 * Hook to get HLS URL for a video
 * Returns HLS URL if available, otherwise returns original URL
 */
export function useHLSUrl(originalUrl) {
    const [hlsUrl, setHlsUrl] = useState(null);
    const [isHLS, setIsHLS] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!originalUrl) return;
        
        // Skip if already HLS
        if (originalUrl.endsWith('.m3u8')) {
            setHlsUrl(originalUrl);
            setIsHLS(true);
            return;
        }

        // Skip if not a video URL
        if (!originalUrl.match(/\.(mp4|mov|avi|mkv|webm|m4v)$/i)) {
            setHlsUrl(null);
            setIsHLS(false);
            return;
        }

        // Check cache first
        if (hlsCache.has(originalUrl)) {
            const cached = hlsCache.get(originalUrl);
            setHlsUrl(cached.hlsUrl);
            setIsHLS(cached.exists);
            return;
        }

        // Check if HLS exists (silently - no console errors)
        const checkHLS = async () => {
            setLoading(true);
            try {
                const expectedHlsUrl = getExpectedHLSUrl(originalUrl, CLOUDFRONT_DOMAIN);
                
                if (expectedHlsUrl) {
                    const response = await fetch(expectedHlsUrl, { method: 'HEAD', mode: 'cors' });
                    
                    if (response.ok) {
                        hlsCache.set(originalUrl, { exists: true, hlsUrl: expectedHlsUrl });
                        setHlsUrl(expectedHlsUrl);
                        setIsHLS(true);
                        return;
                    }
                }
                
                // HLS not available - cache and use MP4
                hlsCache.set(originalUrl, { exists: false, hlsUrl: null });
                setIsHLS(false);
            } catch {
                // Silently fail - use MP4
                hlsCache.set(originalUrl, { exists: false, hlsUrl: null });
                setIsHLS(false);
            } finally {
                setLoading(false);
            }
        };

        checkHLS();
    }, [originalUrl]);

    return { hlsUrl, isHLS, loading, originalUrl };
}

/**
 * Generate expected HLS URL from original video URL
 * Used for immediate playback attempt before API check
 */
export function getExpectedHLSUrl(originalUrl, cloudfrontDomain) {
    if (!originalUrl || !cloudfrontDomain) return null;
    
    try {
        const urlParts = new URL(originalUrl);
        const key = urlParts.pathname.substring(1);
        const baseName = key.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
        return `https://${cloudfrontDomain}/hls/${baseName}/${baseName}.m3u8`;
    } catch {
        return null;
    }
}

export default useHLSUrl;
