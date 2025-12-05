import { memo } from 'react';
import VideoPlayer from './VideoPlayer';
import { RetryImage } from './SafeImage';
import { useHLSUrl } from '../hooks/useHLSUrl';

/**
 * Instagram-Style Smart Media Frame - Optimized
 * - Lazy loading for images and videos
 * - Memoized to prevent unnecessary re-renders
 * - Fast loading with placeholders
 * - HLS adaptive streaming support for videos
 */
const InstagramMediaFrame = memo(({ 
    media, 
    postId, 
    onDelete, 
    onDoubleClick,
    onClick
}) => {
    if (!media) return null;

    const isVideo = media.type === 'video';
    
    // Get HLS URL if available (only for videos)
    const { hlsUrl, isHLS } = useHLSUrl(isVideo ? media.url : null);

    return (
        <div className="instagram-media-frame">
            <div className="relative w-full max-w-[1080px] max-h-[1080px] mx-auto bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {isVideo ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <VideoPlayer 
                            src={media.url}
                            hlsSrc={isHLS ? hlsUrl : null}
                            className="w-full h-full"
                        />
                        {/* HLS badge */}
                        {isHLS && (
                            <div className="absolute top-2 left-2 bg-purple-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded z-10">
                                HD
                            </div>
                        )}
                    </div>
                ) : (
                    <RetryImage
                        src={media.url}
                        alt="Post content"
                        className="w-full h-full object-contain cursor-pointer mx-auto"
                        postId={postId}
                        type="post"
                        onDelete={onDelete}
                        onClick={onClick}
                    />
                )}
            </div>
        </div>
    );
});

InstagramMediaFrame.displayName = 'InstagramMediaFrame';

export default InstagramMediaFrame;
