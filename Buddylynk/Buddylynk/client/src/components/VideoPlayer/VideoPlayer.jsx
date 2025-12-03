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
    const thumbnailVideoRef = useRef(null);
    
    // Video doesn't load until user clicks
    const [videoActivated, setVideoActivated] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [showThumbnailVideo, setShowThumbnailVideo] = useState(true);
    const controlsTimeoutRef = useRef(null);

    // Handle thumbnail video - show first frame
    useEffect(() => {
        const thumbVideo = thumbnailVideoRef.current;
        if (!thumbVideo || !src || videoActivated) return;

        const handleLoaded = () => {
            // Seek to 0.5 seconds to get a good frame
            thumbVideo.currentTime = 0.5;
        };

        const handleSeeked = () => {
            // Thumbnail is ready
            setShowThumbnailVideo(true);
        };

        thumbVideo.addEventListener('loadeddata', handleLoaded);
        thumbVideo.addEventListener('seeked', handleSeeked);

        return () => {
            thumbVideo.removeEventListener('loadeddata', handleLoaded);
            thumbVideo.removeEventListener('seeked', handleSeeked);
        };
    }, [src, videoActivated]);

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
            {/* Show thumbnail video until user clicks */}
            {!videoActivated ? (
                <div className="video-thumbnail-wrapper" onClick={activateVideo}>
                    {/* Use a paused video as thumbnail - shows first frame */}
                    <video
                        ref={thumbnailVideoRef}
                        src={src}
                        className="video-thumbnail"
                        muted
                        playsInline
                        preload="metadata"
                        poster={poster || thumbnail}
                    />
                    <div className="video-play-overlay">
                        <div className="play-button-large">
                            <Play className="w-10 h-10 md:w-14 md:h-14" fill="white" stroke="white" />
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
                                <Play className="w-10 h-10 md:w-14 md:h-14" fill="white" stroke="white" />
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
