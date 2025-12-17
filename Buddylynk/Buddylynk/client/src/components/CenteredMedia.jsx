import { SafeImage } from './SafeImage';

const CenteredMedia = ({ 
    media, 
    className = "", 
    containerClassName = "",
    style = {},
    containerStyle = {},
    ...props 
}) => {
    if (!media) return null;

    const isVideo = media.type === 'video';
    
    // Force centering with inline styles to override any conflicting CSS
    const containerInlineStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black',
        width: '100%',
        height: '100%',
        ...containerStyle
    };

    const mediaInlineStyle = {
        objectFit: 'contain',
        maxWidth: '100%',
        maxHeight: '100%',
        width: 'auto',
        height: 'auto',
        ...style
    };

    return (
        <div 
            className={`${containerClassName}`}
            style={containerInlineStyle}
        >
            {isVideo ? (
                <video
                    src={media.url}
                    className={className}
                    style={mediaInlineStyle}
                    {...props}
                />
            ) : (
                <SafeImage
                    src={media.url}
                    alt="Media content"
                    className={className}
                    style={mediaInlineStyle}
                    {...props}
                />
            )}
        </div>
    );
};

export default CenteredMedia;