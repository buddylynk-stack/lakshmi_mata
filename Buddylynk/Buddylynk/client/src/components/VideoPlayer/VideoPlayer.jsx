import { useState, useRef, useEffect, memo } from 'react';
import { Play, Maximize, Minimize, Settings } from 'lucide-react';
import Hls from 'hls.js';
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

// Detect mobile for performance optimizations
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

const VideoPlayer = memo(({ src, hlsSrc, className = "", poster = null, thumbnail = null }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const progressBarRef = useRef(null);
    const hlsRef = useRef(null);
    
    // Video doesn't load until user clicks - NO thumbnail video loading
    const [videoActivated, setVideoActivated] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [showQuality, setShowQuality] = useState(false);
    const [currentQuality, setCurrentQuality] = useState('auto');
    const [availableQualities, setAvailableQualities] = useState([]);
    const controlsTimeoutRef = useRef(null);
    
    // Determine if we should use HLS
    const isHLS = hlsSrc?.endsWith('.m3u8') || src?.endsWith('.m3u8');
    const videoSource = hlsSrc || src;

    // Handle video events after activation
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !videoActivated) return;
        
        const manager = getPlayManager();
        manager.register(video);
        video.loop = true;

        // Initialize HLS.js for adaptive streaming
        if (isHLS && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                startLevel: -1, // Auto quality selection
            });
            
            hls.loadSource(videoSource);
            hls.attachMedia(video);
            hlsRef.current = hls;
            
            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                // Get available quality levels
                const qualities = data.levels.map((level, index) => ({
                    index,
                    height: level.height,
                    bitrate: level.bitrate,
                    label: `${level.height}p`,
                }));
                setAvailableQualities([{ index: -1, label: 'Auto' }, ...qualities]);
                video.play().catch(() => {});
            });
            
            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                const level = hls.levels[data.level];
                if (level) setCurrentQuality(`${level.height}p`);
            });
            
            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    console.error('HLS fatal error:', data.type);
                    // Fallback to direct MP4 if HLS fails
                    if (src && !src.endsWith('.m3u8')) {
                        video.src = src;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHLS) {
            // Native HLS support (Safari)
            video.src = videoSource;
        } else {
            // Regular MP4
            video.src = videoSource;
        }

        const handleLoadedMetadata = () => setDuration(video.duration);
        // Throttle time updates on mobile for better performance
        let lastUpdate = 0;
        const handleTimeUpdate = () => {
            const now = Date.now();
            if (isMobile && now - lastUpdate < 250) return; // Update every 250ms on mobile
            lastUpdate = now;
            setCurrentTime(video.currentTime);
        };
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
        }, { threshold: 0.3 });

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
            // Cleanup HLS
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [videoActivated, videoSource, isHLS, src]);
    
    // Quality selection handler
    const setQuality = (levelIndex) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex;
            setCurrentQuality(levelIndex === -1 ? 'Auto' : availableQualities.find(q => q.index === levelIndex)?.label);
        }
        setShowQuality(false);
    };

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
            {!videoActivated ? (
                /* Show video thumbnail - loads first frame INSTANTLY */
                <div className="video-thumbnail-wrapper" onClick={activateVideo}>
                    <video
                        src={src}
                        className="video-thumbnail"
                        muted
                        playsInline
                        preload="auto"
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
                                {/* Quality selector for HLS */}
                                {isHLS && availableQualities.length > 1 && (
                                    <div className="quality-selector">
                                        <button 
                                            onClick={() => setShowQuality(!showQuality)} 
                                            className="control-btn quality-btn"
                                        >
                                            <Settings className="w-4 h-4" />
                                            <span className="quality-label">{currentQuality}</span>
                                        </button>
                                        {showQuality && (
                                            <div className="quality-menu">
                                                {availableQualities.map((q) => (
                                                    <button
                                                        key={q.index}
                                                        onClick={() => setQuality(q.index)}
                                                        className={`quality-option ${currentQuality === q.label ? 'active' : ''}`}
                                                    >
                                                        {q.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
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
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
