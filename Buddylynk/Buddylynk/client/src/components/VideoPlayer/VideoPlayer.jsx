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

const VideoPlayer = ({ src, className = "", poster = null }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const progressBarRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const controlsTimeoutRef = useRef(null);

    // Lazy load video when visible in viewport
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // Only need to load once
                }
            },
            { rootMargin: '100px', threshold: 0.1 }
        );

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isVisible) return;
        
        const manager = getPlayManager();
        manager.register(video);

        // Always loop active video
        video.loop = true;

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            setIsLoaded(true);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
        };

        const handleWaiting = () => {
            setIsBuffering(true);
        };

        const handleCanPlay = () => {
            setIsBuffering(false);
            setIsLoaded(true);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        const handlePlay = () => {
            manager.pauseOthers(video);
            setIsPlaying(true);
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('play', handlePlay);

        // Pause when video goes out of view
        const visibilityObserver = new IntersectionObserver(([entry]) => {
            const visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
            if (!visible && !video.paused) {
                video.pause();
                setIsPlaying(false);
            }
        }, { threshold: [0, 0.5, 1] });

        visibilityObserver.observe(video);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('play', handlePlay);
            try { visibilityObserver.disconnect(); } catch {}
            manager.unregister(video);
        };
    }, [isVisible]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (video.paused) {
            video.play();
            setIsPlaying(true);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    };

    const handleProgressClick = (e) => {
        const progressBar = progressBarRef.current;
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoRef.current.currentTime = pos * duration;
    };

    // volume/mute controls removed

    const toggleFullscreen = () => {
        const container = videoRef.current.parentElement;
        if (!document.fullscreenElement) {
            container.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const skip = (seconds) => {
        videoRef.current.currentTime += seconds;
    };

    // togglePiP removed

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
            }
        }, 3000);
    };

    const progress = (currentTime / duration) * 100 || 0;

    // Generate poster from video URL (first frame)
    const videoPoster = poster || (src ? `${src}#t=0.1` : null);

    return (
        <div 
            ref={containerRef}
            className={`video-player-container ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            {/* Only render video when visible in viewport */}
            {isVisible ? (
                <video
                    ref={videoRef}
                    src={src}
                    className="video-element"
                    onClick={togglePlay}
                    playsInline
                    preload="metadata"
                    poster={videoPoster}
                />
            ) : (
                /* Placeholder while not visible */
                <div className="video-placeholder">
                    <Play className="w-12 h-12 text-white/50" />
                </div>
            )}

            {/* Loading Spinner */}
            {isBuffering && (
                <div className="video-loading">
                    <div className="spinner"></div>
                </div>
            )}

            {/* Play/Pause Overlay */}
            {!isPlaying && !isBuffering && (
                <div className="video-play-overlay" onClick={togglePlay}>
                    <div className="play-button-large">
                        <Play className="w-16 h-16" fill="white" />
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className={`video-controls ${showControls ? 'show' : ''}`}>
                {/* Progress Bar */}
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

                {/* Control Buttons */}
                <div className="controls-row">
                    <div className="controls-left">
                        {/* Removed play/pause, skip and volume/mute controls per request */}

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
        </div>
    );
};

export default VideoPlayer;
