import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { SafeImage } from './SafeImage';
import useSwipeGesture from '../hooks/useSwipeGesture';

// Share the same simple play manager as VideoPlayer to pause other videos
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

const InstagramImageViewer = ({ 
    isOpen, 
    onClose, 
    images = [], 
    initialIndex = 0,
    postData = null 
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [mouseStartX, setMouseStartX] = useState(null);
    const [mouseEndX, setMouseEndX] = useState(null);
    const [scale, setScale] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [slideDirection, setSlideDirection] = useState(0);

    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const controlsTimeoutRef = useRef(null);

    // Swipe gesture handling
    const swipeHandlers = useSwipeGesture(
        () => navigateNext(),
        () => navigatePrevious(),
        75
    );

    // Reset index when images change
    useEffect(() => {
        setCurrentIndex(initialIndex);
        setScale(1);
    }, [initialIndex, images]);

    // Auto-hide controls after 3 seconds
    const resetControlsTimeout = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    }, []);

    useEffect(() => {
        if (isOpen) {
            resetControlsTimeout();
        }
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [isOpen, resetControlsTimeout]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyPress = (e) => {
            switch (e.key) {
                case 'Escape':
                    onClose();
                    break;
                case 'ArrowLeft':
                    navigatePrevious();
                    break;
                case 'ArrowRight':
                    navigateNext();
                    break;
                case '+':
                case '=':
                    handleZoomIn();
                    break;
                case '-':
                    handleZoomOut();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isOpen, currentIndex]);

    // Prevent body scroll when viewer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Navigation functions
    const navigateNext = useCallback(() => {
        if (currentIndex < images.length - 1) {
            setSlideDirection(1);
            setCurrentIndex(prev => prev + 1);
            setScale(1);
            resetControlsTimeout();
        }
    }, [currentIndex, images.length, resetControlsTimeout]);

    const navigatePrevious = useCallback(() => {
        if (currentIndex > 0) {
            setSlideDirection(-1);
            setCurrentIndex(prev => prev - 1);
            setScale(1);
            resetControlsTimeout();
        }
    }, [currentIndex, resetControlsTimeout]);

    const handleZoomIn = () => {
        setScale(prev => Math.min(prev + 0.5, 3));
        resetControlsTimeout();
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(prev - 0.5, 1));
        resetControlsTimeout();
    };

    const onMouseDown = (e) => {
        if (scale > 1) return;
        setIsDragging(true);
        setMouseEndX(null);
        setMouseStartX(e.clientX);
    };

    const onMouseMove = (e) => {
        if (!isDragging || scale > 1) return;
        setMouseEndX(e.clientX);
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (mouseStartX == null || mouseEndX == null) return;
        const distance = mouseStartX - mouseEndX;
        const threshold = 75;
        if (distance > threshold) navigateNext();
        if (distance < -threshold) navigatePrevious();
    };

    const onMouseLeave = () => {
        if (isDragging) {
            setIsDragging(false);
            setMouseStartX(null);
            setMouseEndX(null);
        }
    };

    const handleContainerClick = () => {
        resetControlsTimeout();
    };

    const handleVideoClick = (e) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        if (v.muted) {
            v.muted = false;
            v.volume = 0.6;
        }
        if (v.paused) {
            v.play().catch(() => {});
        }
    };

    // Register/unregister viewer video
    useEffect(() => {
        if (!isOpen) return;
        const manager = getPlayManager();
        const v = videoRef.current;
        if (v) {
            v.loop = true;
            manager.register(v);
            const onPlay = () => manager.pauseOthers(v);
            v.addEventListener('play', onPlay);
            return () => {
                v.removeEventListener('play', onPlay);
                manager.unregister(v);
            };
        }
    }, [isOpen, currentIndex]);

    // Auto play video
    useEffect(() => {
        if (!isOpen) return;
        const v = videoRef.current;
        if (v && images[currentIndex]?.type === 'video') {
            const manager = getPlayManager();
            v.loop = true;
            v.play().then(() => manager.pauseOthers(v)).catch(() => {
                v.muted = true;
                v.play().then(() => manager.pauseOthers(v)).catch(() => {});
            });
        }
    }, [isOpen, currentIndex]);

    if (!isOpen || images.length === 0) return null;

    const currentImage = images[currentIndex];
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < images.length - 1;

    // Animation variants
    const slideVariants = {
        enter: (direction) => ({
            x: direction > 0 ? 300 : -300,
            opacity: 0,
            scale: 0.9
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction) => ({
            x: direction < 0 ? 300 : -300,
            opacity: 0,
            scale: 0.9
        })
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm instagram-viewer"
                onClick={onClose}
            >
                {/* Header */}
                <motion.div 
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: showControls ? 0 : -100, opacity: showControls ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-4 bg-gradient-to-b from-black/70 to-transparent"
                >
                    <div className="flex items-center gap-3">
                        {postData && (
                            <>
                                <img 
                                    src={postData.userAvatar} 
                                    alt={postData.username}
                                    className="w-8 h-8 rounded-full"
                                />
                                <span className="text-white font-medium text-sm">
                                    {postData.username}
                                </span>
                            </>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Image counter */}
                        {images.length > 1 && (
                            <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium">
                                {currentIndex + 1} / {images.length}
                            </div>
                        )}
                        
                        {/* Zoom controls */}
                        {currentImage?.type !== 'video' && (
                            <div className="hidden sm:flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                                    disabled={scale <= 1}
                                    className="text-white p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-30"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <span className="text-white text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                                    disabled={scale >= 3}
                                    className="text-white p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-30"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </motion.div>

                {/* Main image container */}
                <div
                    ref={containerRef}
                    className="flex items-center justify-center h-full w-full px-4 py-16"
                    onClick={(e) => { e.stopPropagation(); handleContainerClick(); }}
                    onTouchStart={scale === 1 ? swipeHandlers.onTouchStart : undefined}
                    onTouchMove={scale === 1 ? swipeHandlers.onTouchMove : undefined}
                    onTouchEnd={scale === 1 ? swipeHandlers.onTouchEnd : undefined}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                >
                    <AnimatePresence initial={false} custom={slideDirection} mode="wait">
                        <motion.div
                            key={currentIndex}
                            custom={slideDirection}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ 
                                duration: 0.3, 
                                ease: [0.4, 0, 0.2, 1]
                            }}
                            className="relative max-w-full max-h-full flex items-center justify-center"
                            style={{ 
                                transform: `scale(${scale})`,
                                transition: 'transform 0.2s ease-out'
                            }}
                        >
                            {currentImage.type === 'video' ? (
                                <video
                                    ref={videoRef}
                                    src={currentImage.url}
                                    controls
                                    loop
                                    playsInline
                                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                                    style={{ maxWidth: '100vw', maxHeight: '85vh' }}
                                    onClick={handleVideoClick}
                                />
                            ) : (
                                <SafeImage
                                    src={currentImage.url}
                                    alt={`Image ${currentIndex + 1}`}
                                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl select-none"
                                    style={{ 
                                        maxWidth: '100vw', 
                                        maxHeight: '85vh',
                                        cursor: scale > 1 ? 'grab' : 'default'
                                    }}
                                    draggable={false}
                                    onLoad={() => setIsLoading(false)}
                                    onLoadStart={() => setIsLoading(true)}
                                />
                            )}

                            {/* Loading indicator */}
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                                    <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Bottom navigation dots - Centered with unique design */}
                {images.length > 1 && (
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: showControls ? 0 : 20, opacity: showControls ? 1 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-24 sm:bottom-12 left-0 right-0 flex justify-center items-center z-40"
                    >
                        <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                            {images.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSlideDirection(index > currentIndex ? 1 : -1);
                                        setCurrentIndex(index);
                                        setScale(1);
                                        resetControlsTimeout();
                                    }}
                                    className={`rounded-full transition-all duration-300 ease-out ${
                                        index === currentIndex 
                                            ? 'bg-white w-8 h-2.5 shadow-lg shadow-white/30' 
                                            : 'bg-white/40 hover:bg-white/70 w-2.5 h-2.5'
                                    }`}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Thumbnail strip for multiple images */}
                {images.length > 3 && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: showControls ? 0 : 50, opacity: showControls ? 1 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 hidden sm:flex gap-2 z-40 bg-black/60 backdrop-blur-sm p-2 rounded-xl max-w-[80vw] overflow-x-auto scrollbar-hide"
                    >
                        {images.map((img, index) => (
                            <button
                                key={index}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSlideDirection(index > currentIndex ? 1 : -1);
                                    setCurrentIndex(index);
                                    setScale(1);
                                    resetControlsTimeout();
                                }}
                                className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all duration-200 ${
                                    index === currentIndex 
                                        ? 'ring-2 ring-white scale-110' 
                                        : 'opacity-60 hover:opacity-100'
                                }`}
                            >
                                {img.type === 'video' ? (
                                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                        <span className="text-white text-xs">▶</span>
                                    </div>
                                ) : (
                                    <img 
                                        src={img.url} 
                                        alt={`Thumbnail ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}

                {/* Post content footer */}
                {postData && postData.content && (
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: showControls ? 0 : 50, opacity: showControls ? 1 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-30"
                    >
                        <p className="text-white text-sm max-w-2xl mx-auto text-center line-clamp-2">
                            {postData.content}
                        </p>
                        {postData.likes !== undefined && (
                            <div className="flex justify-center gap-4 mt-2 text-white/80 text-xs">
                                <span>{postData.likes} likes</span>
                                {postData.comments && (
                                    <span>{postData.comments.length} comments</span>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default InstagramImageViewer;
