import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, Bookmark, ArrowLeft, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { SafeAvatar, RetryImage } from "../components/SafeImage";
import VideoPlayer from "../components/VideoPlayer";
import LoadingIndicator from "../components/LoadingIndicator";
import InstagramMediaFrame from "../components/InstagramMediaFrame";

const PostDetail = () => {
    const { postId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket, on, off } = useSocket();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [isCommenting, setIsCommenting] = useState(false);
    const [error, setError] = useState(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showComments, setShowComments] = useState(false);
    const carouselRef = useRef(null);

    useEffect(() => {
        fetchPost();
    }, [postId]);

    // Real-time post updates
    useEffect(() => {
        if (!socket || !postId) return;

        const handlePostUpdated = (updatedPost) => {
            if (updatedPost.postId === postId) {
                console.log("🔄 Post updated in real-time:", postId);
                setPost(updatedPost);
            }
        };

        const handlePostDeleted = (deletedPostId) => {
            if (deletedPostId === postId) {
                console.log("🗑️ Post deleted, redirecting...");
                navigate("/");
            }
        };

        on("postUpdated", handlePostUpdated);
        on("postDeleted", handlePostDeleted);

        return () => {
            off("postUpdated", handlePostUpdated);
            off("postDeleted", handlePostDeleted);
        };
    }, [socket, postId, on, off, navigate]);

    const fetchPost = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`/api/posts/${postId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setPost(res.data);
            
            // Track view
            if (token) {
                await axios.post(`/api/posts/${postId}/view`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
        } catch (error) {
            console.error("Error fetching post:", error);
            setError(error.response?.data?.message || "Post not found");
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async () => {
        if (!user) {
            navigate("/login");
            return;
        }

        const isLiked = post.likedBy?.includes(user.userId);
        setPost(prev => ({
            ...prev,
            likedBy: isLiked 
                ? prev.likedBy.filter(id => id !== user.userId)
                : [...(prev.likedBy || []), user.userId],
            likes: isLiked ? (prev.likes || 1) - 1 : (prev.likes || 0) + 1
        }));

        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/like`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Error liking post:", error);
            // Revert on error
            setPost(prev => ({
                ...prev,
                likedBy: isLiked 
                    ? [...(prev.likedBy || []), user.userId]
                    : prev.likedBy.filter(id => id !== user.userId),
                likes: isLiked ? (prev.likes || 0) + 1 : (prev.likes || 1) - 1
            }));
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!user) {
            navigate("/login");
            return;
        }
        if (!commentText.trim() || isCommenting) return;

        setIsCommenting(true);
        const tempComment = {
            commentId: `temp-${Date.now()}`,
            userId: user.userId,
            username: user.username,
            userAvatar: user.avatar,
            content: commentText,
            createdAt: new Date().toISOString()
        };

        setPost(prev => ({
            ...prev,
            comments: [...(prev.comments || []), tempComment]
        }));
        setCommentText("");

        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/comment`,
                { content: commentText },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchPost(); // Refresh to get real comment
        } catch (error) {
            console.error("Error commenting:", error);
            setPost(prev => ({
                ...prev,
                comments: prev.comments.filter(c => c.commentId !== tempComment.commentId)
            }));
        } finally {
            setIsCommenting(false);
        }
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${post?.username}'s post on Buddylynk`,
                    text: post?.content || 'Check out this post on Buddylynk!',
                    url: shareUrl
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    await copyToClipboard(shareUrl);
                }
            }
        } else {
            await copyToClipboard(shareUrl);
        }

        // Track share
        try {
            const token = localStorage.getItem("token");
            if (token) {
                await axios.post(`/api/posts/${postId}/share`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPost(prev => ({ ...prev, shares: (prev.shares || 0) + 1 }));
            }
        } catch (error) {
            console.error("Error tracking share:", error);
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            
            // Create a more detailed alert showing the URL
            const tempAlert = document.createElement('div');
            tempAlert.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-[9999] max-w-md';
            tempAlert.innerHTML = `
                <div class="flex flex-col gap-2">
                    <div class="font-semibold">Link copied to clipboard!</div>
                    <div class="text-sm bg-white/20 px-3 py-2 rounded break-all">${text}</div>
                </div>
            `;
            document.body.appendChild(tempAlert);
            setTimeout(() => tempAlert.remove(), 5000);
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    const scrollToSlide = (direction) => {
        const carousel = carouselRef.current;
        if (!carousel) return;

        const slideWidth = carousel.offsetWidth;
        const currentScroll = carousel.scrollLeft;
        const newScroll = direction === 'next'
            ? currentScroll + slideWidth
            : currentScroll - slideWidth;

        carousel.scrollTo({
            left: newScroll,
            behavior: 'smooth'
        });
    };

    const handleScroll = () => {
        const carousel = carouselRef.current;
        if (!carousel || !post?.media) return;

        const slideWidth = carousel.offsetWidth;
        const currentIndex = Math.round(carousel.scrollLeft / slideWidth);
        setCurrentSlide(currentIndex);
    };

    if (loading) {
        return (
            <div className="min-h-screen md:pl-72 pt-4 pb-20 md:pb-4 md:pr-4 dark:bg-dark bg-gray-100 flex items-center justify-center">
                <LoadingIndicator />
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="min-h-screen md:pl-72 pt-4 pb-20 md:pb-4 md:pr-4 dark:bg-dark bg-gray-100">
                <div className="max-w-2xl mx-auto px-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                    <div className="glass-panel p-8 text-center">
                        <p className="dark:text-gray-400 text-gray-600 text-lg">{error || "Post not found"}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen md:pl-72 pt-4 pb-24 md:pb-4 md:pr-4 dark:bg-dark bg-gray-100">
            <div className="max-w-2xl mx-auto px-3 sm:px-4">
                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 mb-4 transition-colors p-2 -ml-2 rounded-xl hover:bg-white/5"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm sm:text-base">Back</span>
                </button>

                {/* Highlighted Post */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-4 ring-2 ring-primary/50 shadow-xl"
                >
                    {/* Post Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <SafeAvatar
                            src={post.userAvatar}
                            alt={post.username}
                            fallbackText={post.username}
                            className="w-12 h-12 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate(`/profile/${post.userId}`)}
                        />
                        <div className="flex-1">
                            <h3
                                onClick={() => navigate(`/profile/${post.userId}`)}
                                className="font-bold dark:text-white text-gray-900 cursor-pointer hover:text-primary transition-colors"
                            >
                                {post.username}
                            </h3>
                            <p className="text-xs dark:text-gray-400 text-gray-600">
                                {new Date(post.createdAt).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Post Content */}
                    <p className="dark:text-gray-200 text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>

                    {/* Media */}
                    {post.media && post.media.length > 0 && (
                        <div className="mb-4 relative rounded-xl overflow-hidden group">
                            {post.media.length === 1 ? (
                                // Single media - Instagram frame
                                <InstagramMediaFrame
                                    media={post.media[0]}
                                    postId={post.postId}
                                />
                            ) : (
                                // Multiple media - carousel
                                <div className="relative">
                                    <div
                                        ref={carouselRef}
                                        onScroll={handleScroll}
                                        className="overflow-x-auto snap-x snap-mandatory flex scrollbar-hide"
                                    >
                                        {post.media.map((mediaItem, index) => (
                                            <div
                                                key={index}
                                                className="w-full flex-shrink-0 snap-center"
                                            >
                                                <InstagramMediaFrame
                                                    media={mediaItem}
                                                    postId={post.postId}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Counter Badge */}
                                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium z-10">
                                        {currentSlide + 1}/{post.media.length}
                                    </div>

                                    {/* Navigation Arrows */}
                                    {currentSlide > 0 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                scrollToSlide('prev');
                                            }}
                                            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 p-2 rounded-full shadow-lg z-10 transition-all"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                    )}

                                    {currentSlide < post.media.length - 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                scrollToSlide('next');
                                            }}
                                            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 p-2 rounded-full shadow-lg z-10 transition-all"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    )}

                                    {/* Dots Indicator */}
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                        {post.media.map((_, index) => (
                                            <div
                                                key={index}
                                                className={`w-1.5 h-1.5 rounded-full transition-all ${
                                                    index === currentSlide
                                                        ? 'bg-white w-2'
                                                        : 'bg-white/60'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm dark:text-gray-400 text-gray-600 mb-4 pb-4 border-b dark:border-white/10 border-gray-200">
                        <span>{post.likes || 0} likes</span>
                        <span>{post.comments?.length || 0} comments</span>
                        <span>{post.shares || 0} shares</span>
                        <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {post.views || 0}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 mb-4">
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 transition-colors ${
                                post.likedBy?.includes(user?.userId)
                                    ? "text-red-500"
                                    : "dark:text-gray-400 text-gray-600 dark:hover:text-red-500 hover:text-red-500"
                            }`}
                        >
                            <Heart className="w-5 h-5" fill={post.likedBy?.includes(user?.userId) ? "currentColor" : "none"} />
                            <span>Like</span>
                        </button>
                        <button 
                            onClick={() => setShowComments(!showComments)}
                            className="flex items-center gap-2 dark:text-gray-400 text-gray-600 dark:hover:text-primary hover:text-primary transition-colors"
                        >
                            <MessageCircle className="w-5 h-5" />
                            <span>Comment</span>
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-2 dark:text-gray-400 text-gray-600 dark:hover:text-primary hover:text-primary transition-colors"
                        >
                            <Share2 className="w-5 h-5" />
                            <span>Share</span>
                        </button>
                    </div>

                    {/* Comments Section */}
                    {showComments && (
                        <div className="space-y-4">
                            <h4 className="font-semibold dark:text-white text-gray-900">Comments</h4>
                            
                            {/* Comment Input */}
                            {user ? (
                            <form onSubmit={handleComment} className="flex gap-2">
                                <SafeAvatar
                                    src={user.avatar}
                                    alt={user.username}
                                    fallbackText={user.username}
                                    className="w-8 h-8 rounded-full"
                                />
                                <input
                                    type="text"
                                    placeholder="Write a comment..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    className="flex-1 input-field"
                                />
                                <button
                                    type="submit"
                                    disabled={!commentText.trim() || isCommenting}
                                    className="btn-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isCommenting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Posting...
                                        </>
                                    ) : (
                                        'Post'
                                    )}
                                </button>
                            </form>
                        ) : (
                            <div className="text-center py-4">
                                <button
                                    onClick={() => navigate("/login")}
                                    className="text-primary hover:text-primary-hover"
                                >
                                    Login to comment
                                </button>
                            </div>
                        )}

                        {/* Comments List */}
                        <div className="space-y-3">
                            {post.comments && post.comments.length > 0 ? (
                                post.comments.map((comment) => (
                                    <div key={comment.commentId} className="flex gap-3">
                                        <SafeAvatar
                                            src={comment.userAvatar}
                                            alt={comment.username}
                                            fallbackText={comment.username}
                                            className="w-8 h-8 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => navigate(`/profile/${comment.userId}`)}
                                        />
                                        <div className="flex-1 dark:bg-white/5 bg-gray-100 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className="font-semibold dark:text-white text-gray-900 text-sm cursor-pointer hover:text-primary transition-colors"
                                                    onClick={() => navigate(`/profile/${comment.userId}`)}
                                                >
                                                    {comment.username}
                                                </span>
                                                <span className="text-xs dark:text-gray-500 text-gray-600">
                                                    {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="dark:text-gray-300 text-gray-800 text-sm">{comment.content}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center dark:text-gray-500 text-gray-600 py-4">No comments yet</p>
                            )}
                        </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default PostDetail;
