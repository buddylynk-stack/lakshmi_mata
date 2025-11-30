import { useState } from 'react';
import VideoPlayer from './VideoPlayer';
import { RetryImage } from './SafeImage';

/**
 * Instagram-Style Smart Media Frame
 * - Fixed max width: 1080px
 * - Dynamic height based on image aspect ratio
 * - Shows full image without cropping
 * - CONTAIN fit mode (shows complete image)
 * - No black bars or letterboxing
 * - Responsive on all devices
 */
const InstagramMediaFrame = ({ 
    media, 
    postId, 
    onDelete, 
    onDoubleClick,
    onClick
}) => {
    const [imageError, setImageError] = useState(false);

    if (!media) return null;

    const isVideo = media.type === 'video';

    return (
        <div className="instagram-media-frame">
            {/* Dynamic height container with max-height 1080px */}
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
                        onDoubleClick={onDoubleClick}
                        onClick={onClick}
                        onError={() => setImageError(true)}
                    />
                )}
            </div>
        </div>
    );
};

export default InstagramMediaFrame;
