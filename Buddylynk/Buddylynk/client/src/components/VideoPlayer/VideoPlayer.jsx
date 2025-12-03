import { useState, useRef, useEffect } from 'react';
import { Play, Maximize, Minimize } from 'lucide-react';
import './VideoPlayer.css';

// Simple global manager to ensure only one video plays at a time
const getPlayManager = () => {
    if (!window.__VideoPlayManager) {
        window.__VideoPlayManager = {
            players: new Set(),
            register(video) { this.players.add(video); },
            unregister(video) { this.players.delete(video); },
            pauseOthers(active) {
                this.players.forEach(v => {
                    if (v !== active && !v.paused) {
                        try { v.pause(); } catch {}
                    }
                });
            },
        };
    }
    return window.__VideoPlayManager;
};

const VideoPlayer = ({ src, className = "", poster = null, thumbnail = null }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const progressBarRef = useRef(null);
    
    // Video doesn't load until user clicks
    const [videoActivated, setVideoActivated] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [thumbnailUrl, setThumbnailUrl] = useState(thumbnail || poster);
    const controlsTimeoutRef = useRef(null);

    // Generate thumbnail from video (first frame) if not provided
    useEffect(() => {
        if (thumbnailUrl || !src) return;
        
        // Create a hidden video to extract thumbnail
        const tempVideo = document.createElement('video');
        tempVideo.crossOrigin = 'anonymous';
        tempVideo.muted = true;
        tempVideo.preload = 'metadata';
        
        tempVideo.onloadeddata = () => {
            tempVideo.currentTime = 0.1; // Get frame at 0.1 seconds
        };
        
        tempVideo.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = tempVideo.videoWidth;
                canvas.height = tempVideo.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempVideo, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                setThumbnailUrl(dataUrl);
            } catch (e) {
                // CORS error - use video URL with time fragment as fallback
                setThumbnailUrl(`${src}#t=0.1`);
            }
            tempVideo.remove();
        };
        
        tempVideo.onerror = () => {
            setThumbnailUrl(`${src}#t=0.1`);
        };
        
        tempVideo.src = src;
    }, [src, thumbnailUrl]);

    // Handle video events after activation
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !videoActivated) return;
        
        const manager = getPlayManager();
        manager.register(video);
        video.loop = true;

        const handleLoadedMetadata = () => setDuration(video.duration);
        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleWaiting = () => setIsBuffering(true);
        const handleCanPlay = () => {
            setIsBuffering(false);
            // Auto-play when video is ready
            video.play().catch(() => {});
        };
        const handleEnded = () => setIsPlaying(false);
        const handlePlay = () => {
            manager.pauseOthers(video);
            setIsPlaying(true);
        };
        const handlePause = () => setIsPlaying(false);

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);

        // Pause when video goes out of view
        const visibilityObserver = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting && !video.paused) {
                video.pause();
            }
        }, { threshold: 0.5 });

        visibilityObserver.observe(video);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            try { visibilityObserver.disconnect(); } catch {}
            manager.unregister(video);
        };
    }, [videoActivated]);

    // User clicks thumbnail to activate video
    const activateVideo = () => {
        setVideoActivated(true);
        setIsBuffering(true);
    };

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    };

    const handleProgressClick = (e) => {
        if (!videoRef.current) return;
        const progressBar = progressBarRef.current;
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pos * duration;
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!document.fullscreenElement) {
            container.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    };

    const progress = (currentTime / duration) * 100 || 0;

    return (
        <div 
            ref={containerRef}
            className={`video-player-container ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            {/* Show thumbnail until user clicks */}
            {!videoActivated ? (
                <div className="video-thumbnail-wrapper" onClick={activateVideo}>
                    {thumbnailUrl ? (
                        <img 
                            src={thumbnailUrl} 
                            alt="Video thumbnail" 
                            className="video-thumbnail"
                            loading="lazy"
                        />
                    ) : (
                        <div className="video-placeholder" />
                    )}
                    <div className="video-play-overlay">
                        <div className="play-button-large">
                            <Play className="w-12 h-12 md:w-16 md:h-16" fill="white" />
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <video
                        ref={videoRef}
                        src={src}
                        className="video-element"
                        onClick={togglePlay}
                        playsInline
                        preload="auto"
                        poster={thumbnailUrl}
                    />

                    {/* Loading Spinner */}
                    {isBuffering && (
                        <div className="video-loading">
                            <div className="spinner"></div>
                        </div>
                    )}

                    {/* Play/Pause Overlay - only show when paused */}
                    {!isPlaying && !isBuffering && (
                        <div className="video-play-overlay" onClick={togglePlay}>
                            <div className="play-button-large">
                                <Play className="w-12 h-12 md:w-16 md:h-16" fill="white" />
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className={`video-controls ${showControls ? 'show' : ''}`}>
                        <div 
                            ref={progressBarRef}
                            className="progress-bar-container"
                            onClick={handleProgressClick}
                        >
                            <div className="progress-bar-bg">
                                <div 
                                    className="progress-bar-fill"
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="progress-bar-thumb"></div>
                                </div>
                            </div>
                        </div>

                        <div className="controls-row">
                            <div className="controls-left">
                                <div className="time-display">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </div>
                            </div>
                            <div className="controls-right">
                                <button onClick={toggleFullscreen} className="control-btn">
                                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default VideoPlayer;
