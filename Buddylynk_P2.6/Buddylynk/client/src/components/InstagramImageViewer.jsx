import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
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

    const containerRef = useRef(null);
    const videoRef = useRef(null);

    // Swipe gesture handling
    const swipeHandlers = useSwipeGesture(
        () => navigateNext(), // onSwipeLeft
        () => navigatePrevious(), // onSwipeRight
        75 // threshold
    );

    // Reset index when images change
    useEffect(() => {
        setCurrentIndex(initialIndex);
    }, [initialIndex, images]);

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

    // Navigation functions with boundary checks
    const navigateNext = () => {
        if (currentIndex < images.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const navigatePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const onMouseDown = (e) => {
        setIsDragging(true);
        setMouseEndX(null);
        setMouseStartX(e.clientX);
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
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

    // Register/unregister viewer video with global manager when open
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

    // Auto play current video when index changes (and viewer open)
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

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm instagram-viewer"
                onClick={onClose}
            >
                {/* Header with close button and counter */}
                <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-4 bg-gradient-to-b from-black/50 to-transparent">
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
                    
                    <div className="flex items-center gap-4">
                        {images.length > 1 && (
                            <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                                {currentIndex + 1} / {images.length}
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Main image container */}
                <div
                    ref={containerRef}
                    className="flex items-center justify-center h-full w-full px-4 py-16"
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={swipeHandlers.onTouchStart}
                    onTouchMove={swipeHandlers.onTouchMove}
                    onTouchEnd={swipeHandlers.onTouchEnd}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                >
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="relative max-w-full max-h-full flex items-center justify-center"
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
                                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                                style={{ maxWidth: '100vw', maxHeight: '85vh' }}
                                onLoad={() => setIsLoading(false)}
                                onLoadStart={() => setIsLoading(true)}
                            />
                        )}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Navigation arrows for desktop */}
                {images.length > 1 && (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigatePrevious();
                            }}
                            disabled={currentIndex === 0}
                            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed z-40 hidden md:flex items-center justify-center"
                        >
                            <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
                        </button>
                        
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigateNext();
                            }}
                            disabled={currentIndex === images.length - 1}
                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed z-40 hidden md:flex items-center justify-center"
                        >
                            <ChevronRight className="w-6 h-6" strokeWidth={2.5} />
                        </button>
                    </>
                )}

                {/* Mobile navigation dots */}
                {images.length > 1 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-40 md:hidden">
                        {images.map((_, index) => (
                            <button
                                key={index}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentIndex(index);
                                }}
                                className={`w-2 h-2 rounded-full transition-all ${
                                    index === currentIndex 
                                        ? 'bg-white scale-125' 
                                        : 'bg-white/50 hover:bg-white/75'
                                }`}
                            />
                        ))}
                    </div>
                )}

                {/* Swipe indicator for mobile */}
                {images.length > 1 && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center md:hidden">
                        Swipe left or right to navigate
                    </div>
                )}

                {/* Post content footer */}
                {postData && postData.content && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-40">
                        <p className="text-white text-sm max-w-2xl mx-auto text-center">
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
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default InstagramImageViewer;