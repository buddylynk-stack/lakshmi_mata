import { memo } from 'react';
import VideoPlayer from './VideoPlayer';
import { RetryImage } from './SafeImage';

/**
 * Instagram-Style Smart Media Frame - Optimized
 * - Lazy loading for images and videos
 * - Memoized to prevent unnecessary re-renders
 * - Fast loading with placeholders
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

    return (
        <div className="instagram-media-frame">
            <div className="relative w-full max-w-[1080px] max-h-[1080px] mx-auto bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {isVideo ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <VideoPlayer 
                            src={media.url}
                            className="w-full h-full"
                        />
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
