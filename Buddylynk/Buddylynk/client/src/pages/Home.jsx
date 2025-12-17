import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, Send, Heart, MessageCircle, Share2, Bell, BarChart2, X, Bookmark, Eye, MoreVertical, Edit2, Trash2, ChevronLeft, ChevronRight, UserX, Pin, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { useRealTimePosts } from "../hooks/useRealTimePosts";
import { RetryImage, SafeAvatar } from "../components/SafeImage";
import VideoPlayer from "../components/VideoPlayer";
import LoadingIndicator from "../components/LoadingIndicator";
import HamsterLoader from "../components/HamsterLoader";
import ConfirmModal from "../components/ConfirmModal";
import InstagramMediaFrame from "../components/InstagramMediaFrame";
import InstagramImageViewer from "../components/InstagramImageViewer";
import SensitiveMediaWrapper from "../components/SensitiveMediaWrapper";
import { uploadViaServer, uploadMultipleFiles } from "../utils/serverUpload";
import LoginPrompt from "../components/LoginPrompt";
import { containerVariants, itemVariants, scaleVariants, fadeVariants, fastTransition } from "../utils/animations";
// Shadcn-style UI Components
import UploadProgress from "../components/ui/UploadProgress";
import AlertDialog from "../components/ui/AlertDialog";

const Home = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [uploadStage, setUploadStage] = useState("uploading"); // uploading, checking, saving, complete
    const [newPost, setNewPost] = useState("");
    const [media, setMedia] = useState([]);
    const [showPollForm, setShowPollForm] = useState(false);
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showComments, setShowComments] = useState({});
    const [commentText, setCommentText] = useState({});
    const [showMenu, setShowMenu] = useState({});
    const [editingPost, setEditingPost] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [editMedia, setEditMedia] = useState(null);
    const [removeMedia, setRemoveMedia] = useState(false);
    const [currentMedia, setCurrentMedia] = useState(null);
    const [currentSlide, setCurrentSlide] = useState({});
    const [fullscreenMedia, setFullscreenMedia] = useState(null);
    const [fullscreenIndex, setFullscreenIndex] = useState(0);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerImages, setViewerImages] = useState([]);
    const [viewerPostData, setViewerPostData] = useState(null);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(null);
    const [showDeleteCommentConfirm, setShowDeleteCommentConfirm] = useState(null);
    const [showBlockUserConfirm, setShowBlockUserConfirm] = useState(null);
    const [showCommentMenu, setShowCommentMenu] = useState({});
    const [editingComment, setEditingComment] = useState(null);
    const [editCommentText, setEditCommentText] = useState("");
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [loginPromptMessage, setLoginPromptMessage] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const carouselRefs = useRef({});
    const feedContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const { user } = useAuth();
    const { notifications, unreadCount, markAsRead, clearAll } = useNotifications();
    const { socket, isConnected } = useSocket();
    const toast = useToast();

    const [userAvatars, setUserAvatars] = useState({});

    // Helper function to require login for actions
    const requireLogin = (action, message) => {
        if (!user) {
            setLoginPromptMessage(message || "Please login to " + action);
            setShowLoginPrompt(true);
            return true;
        }
        return false;
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    // Pull-to-refresh handler for mobile
    const handlePullToRefresh = async () => {
        if (isRefreshing || loading) return;
        setIsRefreshing(true);
        await fetchPosts(true); // Refresh with zigzag shuffle
        setIsRefreshing(false);
        toast.success("Feed refreshed with new order!");
    };

    // Fetch avatars when posts change
    useEffect(() => {
        if (posts.length > 0) {
            fetchUserAvatars();
        }
    }, [posts]);

    const fetchUserAvatars = async () => {
        try {
            // Get unique user IDs from posts
            const userIds = [...new Set(posts.map(post => post.userId))];

            // Filter out IDs we already have (optional optimization, but good for performance)
            const missingUserIds = userIds.filter(id => !userAvatars[id]);

            if (missingUserIds.length === 0) return;

            const res = await axios.post("/api/users/batch", { userIds: missingUserIds });

            // Update state with new avatars
            setUserAvatars(prev => {
                const newAvatars = { ...prev };
                Object.values(res.data).forEach(user => {
                    newAvatars[user.userId] = user.avatar;
                });
                return newAvatars;
            });
        } catch (error) {
            console.error("Error fetching user avatars:", error);
        }
    };

    // Real-time post updates via custom hook (prevents memory leaks)
    useRealTimePosts(setPosts);

    // Listen for upload progress updates
    useEffect(() => {
        if (!socket) return;

        const handleUploadProgress = (data) => {
            console.log("Upload progress:", data);
            setUploadProgress(data.progress);

            if (data.stage === "complete") {
                setUploadSuccess(true);
                setTimeout(() => {
                    setUploading(false);
                    setUploadSuccess(false);
                    setUploadProgress(0);
                }, 2000);
            }
        };

        socket.on("uploadProgress", handleUploadProgress);

        return () => {
            socket.off("uploadProgress", handleUploadProgress);
        };
    }, [socket]);

    useEffect(() => {
        // Server-side view tracking with Intersection Observer
        const viewedInSession = new Set(); // Track in current session to avoid duplicate API calls
        const viewTimers = {};

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const postId = entry.target.dataset.postId;

                    if (entry.isIntersecting) {
                        // Post is visible - start timer
                        if (!viewedInSession.has(postId)) {
                            viewTimers[postId] = setTimeout(() => {
                                // Only count as view if visible for 2+ seconds
                                handleView(postId);
                                viewedInSession.add(postId); // Prevent duplicate calls in same session
                            }, 2000); // 2 second threshold
                        }
                    } else {
                        // Post left viewport - clear timer
                        if (viewTimers[postId]) {
                            clearTimeout(viewTimers[postId]);
                            delete viewTimers[postId];
                        }
                    }
                });
            },
            {
                threshold: 0.5, // 50% of post must be visible
                rootMargin: '0px'
            }
        );

        // Observe all post elements
        const postElements = document.querySelectorAll('[data-post-id]');
        postElements.forEach((el) => observer.observe(el));

        return () => {
            observer.disconnect();
            Object.values(viewTimers).forEach(timer => clearTimeout(timer));
        };
    }, [posts]);

    const fetchPosts = async (refresh = false) => {
        // If refresh requested, clear cache and fetch with zigzag shuffle
        if (refresh) {
            sessionStorage.removeItem('buddylynk_feed_cache');
            setLoading(true);
            await fetchFreshPosts(true, true); // Pass refresh=true to API
            return;
        }

        // Try to load from cache first for instant display
        const cacheKey = 'buddylynk_feed_cache';
        const cachedData = sessionStorage.getItem(cacheKey);

        if (cachedData) {
            try {
                const { posts: cachedPosts, timestamp } = JSON.parse(cachedData);
                const cacheAge = Date.now() - timestamp;
                // Use cache if less than 2 minutes old
                if (cacheAge < 120000 && cachedPosts.length > 0) {
                    setPosts(cachedPosts);
                    setLoading(false);
                    // Fetch fresh data in background (no shuffle)
                    fetchFreshPosts(false, false);
                    return;
                }
            } catch (e) {
                sessionStorage.removeItem(cacheKey);
            }
        }

        setLoading(true);
        await fetchFreshPosts(true, false);
    };

    const fetchFreshPosts = async (showLoading = true, refresh = false) => {
        try {
            const endpoint = "/api/posts/feed";
            const res = await axios.get(endpoint, {
                params: {
                    limit: 20,
                    refresh: refresh ? 'true' : undefined // Triggers zigzag shuffle on server
                },
                timeout: 30000
            });

            const feedPosts = res.data.posts || res.data;
            const algorithm = res.data.algorithm || 'unknown';

            // Log the algorithm used
            console.log(`📰 Feed loaded with algorithm: ${algorithm}`);

            const blockedUsers = user?.blockedUsers || [];
            const filteredPosts = feedPosts.filter(post => !blockedUsers.includes(post.userId));
            const validPosts = filteredPosts.filter(post =>
                post.createdAt && post.username && post.userId
            );

            setPosts(validPosts);

            // Cache the posts
            sessionStorage.setItem('buddylynk_feed_cache', JSON.stringify({
                posts: validPosts,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handlePostSubmit = async (e) => {
        e.preventDefault();

        // Require login to create post
        if (requireLogin("post", "Please login to create posts")) return;

        // Prevent double submission
        if (uploading) return;

        // Validate content
        if (!newPost.trim() && media.length === 0 && !showPollForm) return;

        try {
            setUploading(true);
            setUploadProgress(0);
            setUploadSuccess(false);
            setUploadStage("uploading");

            // Upload media files with compression and parallel upload (much faster!)
            let uploadedMedia = [];
            if (media.length > 0) {
                if (media.length === 1) {
                    // Single file - use regular upload
                    const file = media[0];
                    const mediaUrl = await uploadViaServer(file, (progress) => {
                        setUploadProgress(Math.round(progress * 0.8));
                    });
                    const mediaType = file.type.startsWith("image") ? "image" : "video";
                    uploadedMedia = [{ url: mediaUrl, type: mediaType }];
                } else {
                    // Multiple files - use parallel upload (3x faster!)
                    uploadedMedia = await uploadMultipleFiles(media, (progress) => {
                        setUploadProgress(Math.round(progress * 0.8));
                    });
                }
            }

            setUploadProgress(85);
            setUploadStage("checking");

            // Prepare post data (send only URLs, not files)
            const postData = {
                content: newPost,
                media: uploadedMedia,
            };

            // Add poll options if poll form is open and has values
            if (showPollForm) {
                const validOptions = pollOptions.filter(opt => opt.trim());
                if (validOptions.length >= 2) {
                    postData.pollOptions = validOptions;
                }
            }

            setUploadProgress(90);
            setUploadStage("saving");

            // Create post with media URLs (small JSON payload)
            // Note: Post will be added via real-time Redis broadcast (useRealTimePosts)
            await axios.post("/api/posts/with-urls", postData);

            setNewPost("");
            setMedia([]);
            setShowPollForm(false);
            setPollOptions(["", ""]);
            
            // Reset file input so same files can be uploaded again
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            // Show success and hide upload indicator
            setUploadProgress(100);
            setUploadStage("complete");
            setUploadSuccess(true);
            toast.success("Post created successfully! 🎉");
            setTimeout(() => {
                setUploading(false);
                setUploadSuccess(false);
                setUploadProgress(0);
                setUploadStage("uploading");
            }, 2000);
        } catch (error) {
            console.error("Error creating post:", error);
            toast.error("Failed to create post");
            setUploading(false);
            setUploadStage("uploading");
        }
    };

    const handleVote = async (postId, optionId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/vote`,
                { optionId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Real-time update will come via socket
        } catch (error) {
            console.error("Error voting:", error.response?.data?.message || error);
        }
    };

    const addPollOption = () => {
        setPollOptions([...pollOptions, ""]);
    };

    const handleDeletePost = async (postId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/posts/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPosts(posts.filter(p => p.postId !== postId));
            toast.success("Post deleted successfully");
        } catch (error) {
            console.error("Error deleting post:", error);
            toast.error("Failed to delete post");
        }
    };

    // Track user interactions for ML recommendations
    const trackInteraction = async (postId, action, duration = 0) => {
        if (!user) return; // Only track for logged-in users

        try {
            const token = localStorage.getItem("token");
            await axios.post("/api/posts/track", {
                postId,
                action,
                duration
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            // Silent fail - tracking shouldn't break UX
            console.debug("Tracking error:", error);
        }
    };

    const handleLike = async (postId) => {
        // Require login to like
        if (requireLogin("like", "Please login to like posts")) return;

        // Optimistic update - update UI immediately
        setPosts(prevPosts => prevPosts.map(post => {
            if (post.postId === postId) {
                const isLiked = post.likedBy?.includes(user.userId);
                return {
                    ...post,
                    likedBy: isLiked
                        ? post.likedBy.filter(id => id !== user.userId)
                        : [...(post.likedBy || []), user.userId],
                    likes: isLiked ? (post.likes || 1) - 1 : (post.likes || 0) + 1
                };
            }
            return post;
        }));

        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/like`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Track like interaction for ML
            trackInteraction(postId, 'like');
        } catch (error) {
            console.error("Error liking post:", error);
            // Revert on error
            setPosts(prevPosts => prevPosts.map(post => {
                if (post.postId === postId) {
                    const isLiked = post.likedBy?.includes(user.userId);
                    return {
                        ...post,
                        likedBy: isLiked
                            ? post.likedBy.filter(id => id !== user.userId)
                            : [...(post.likedBy || []), user.userId],
                        likes: isLiked ? (post.likes || 1) - 1 : (post.likes || 0) + 1
                    };
                }
                return post;
            }));
        }
    };

    const handleComment = async (postId) => {
        // Require login to comment
        if (requireLogin("comment", "Please login to comment on posts")) return;

        const content = commentText[postId];
        if (!content?.trim()) return;

        const tempComment = {
            commentId: `temp-${Date.now()}`,
            userId: user.userId,
            username: user.username,
            avatar: user.avatar,
            content,
            createdAt: new Date().toISOString()
        };

        // Optimistic update - add comment immediately
        setPosts(prevPosts => prevPosts.map(post => {
            if (post.postId === postId) {
                return {
                    ...post,
                    comments: [...(post.comments || []), tempComment]
                };
            }
            return post;
        }));

        setCommentText({ ...commentText, [postId]: "" });

        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/comment`,
                { content },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Track comment interaction for ML
            trackInteraction(postId, 'comment');

            // Real-time update will replace temp comment
        } catch (error) {
            console.error("Error commenting:", error);
            // Revert on error
            setPosts(prevPosts => prevPosts.map(post => {
                if (post.postId === postId) {
                    return {
                        ...post,
                        comments: post.comments.filter(c => c.commentId !== tempComment.commentId)
                    };
                }
                return post;
            }));
            setCommentText({ ...commentText, [postId]: content });
        }
    };

    const handleEditComment = (postId, comment) => {
        setEditingComment(`${postId}-${comment.commentId}`);
        setEditCommentText(comment.content);
        setShowCommentMenu({});
    };

    const handleSaveCommentEdit = async (postId, commentId) => {
        if (!editCommentText.trim()) return;

        try {
            const token = localStorage.getItem("token");
            await axios.put(`/api/posts/${postId}/comment/${commentId}`,
                { content: editCommentText },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update locally
            setPosts(prevPosts => prevPosts.map(post => {
                if (post.postId === postId) {
                    return {
                        ...post,
                        comments: post.comments.map(c =>
                            c.commentId === commentId
                                ? { ...c, content: editCommentText, editedAt: new Date().toISOString() }
                                : c
                        )
                    };
                }
                return post;
            }));

            setEditingComment(null);
            setEditCommentText("");
        } catch (error) {
            console.error("Error editing comment:", error);
        }
    };

    const handleDeleteComment = async (postId, commentId) => {
        setShowDeleteCommentConfirm({ postId, commentId });
    };

    const executeDeleteComment = async (postId, commentId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/posts/${postId}/comment/${commentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update locally
            setPosts(prevPosts => prevPosts.map(post => {
                if (post.postId === postId) {
                    return {
                        ...post,
                        comments: post.comments.filter(c => c.commentId !== commentId)
                    };
                }
                return post;
            }));
            toast.success("Comment deleted");
        } catch (error) {
            console.error("Error deleting comment:", error);
            toast.error("Failed to delete comment");
        }
    };

    const handlePinComment = async (postId, commentId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/comment/${commentId}/pin`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update locally
            setPosts(prevPosts => prevPosts.map(post => {
                if (post.postId === postId) {
                    return {
                        ...post,
                        pinnedCommentId: post.pinnedCommentId === commentId ? null : commentId
                    };
                }
                return post;
            }));

            setShowCommentMenu({});
        } catch (error) {
            console.error("Error pinning comment:", error);
        }
    };

    const toggleCommentMenu = (postId, commentId) => {
        const key = `${postId}-${commentId}`;
        setShowCommentMenu({ ...showCommentMenu, [key]: !showCommentMenu[key] });
    };

    const handleShare = async (postId) => {
        // Require login to share
        if (requireLogin("share", "Please login to share posts")) return;

        const post = posts.find(p => p.postId === postId);
        const shareUrl = `${window.location.origin}/post/${postId}`;

        // Optimistic update - increment share count immediately
        setPosts(prevPosts => prevPosts.map(p => {
            if (p.postId === postId) {
                return {
                    ...p,
                    shares: (p.shares || 0) + 1
                };
            }
            return p;
        }));

        // Try Web Share API first (mobile devices)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${post?.username}'s post on Buddylynk`,
                    text: post?.content || 'Check out this post on Buddylynk!',
                    url: shareUrl
                });

                // Show success message
                const tempAlert = document.createElement('div');
                tempAlert.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] animate-fade-in';
                tempAlert.textContent = 'Shared successfully!';
                document.body.appendChild(tempAlert);
                setTimeout(() => tempAlert.remove(), 3000);
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Error sharing:", error);
                    // Fallback to clipboard
                    await copyToClipboard(shareUrl);
                }
            }
        } else {
            // Fallback: Copy to clipboard
            await copyToClipboard(shareUrl);
        }

        // Track share on server
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/share`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Track share interaction for ML
            trackInteraction(postId, 'share');
        } catch (error) {
            console.error("Error tracking share:", error);
            // Revert on error
            setPosts(prevPosts => prevPosts.map(p => {
                if (p.postId === postId) {
                    return {
                        ...p,
                        shares: Math.max(0, (p.shares || 1) - 1)
                    };
                }
                return p;
            }));
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);

            // Create a more detailed alert showing the URL
            const tempAlert = document.createElement('div');
            tempAlert.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-[9999] animate-fade-in max-w-md';
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

    const handleSave = async (postId) => {
        // Require login to save
        if (requireLogin("save", "Please login to save posts")) return;

        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/posts/${postId}/save`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Track save interaction for ML
            trackInteraction(postId, 'save');

            // Real-time update will come via socket
        } catch (error) {
            console.error("Error saving post:", error);
        }
    };

    const handleView = async (postId) => {
        try {
            const token = localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`/api/posts/${postId}/view`, {}, { headers });

            // Track view interaction for ML (only for logged-in users)
            if (user) {
                trackInteraction(postId, 'view', 2); // 2 seconds minimum view time
            }
        } catch (error) {
            console.error("Error incrementing view:", error);
        }
    };

    const toggleComments = (postId) => {
        setShowComments({ ...showComments, [postId]: !showComments[postId] });
    };

    const toggleMenu = (postId) => {
        setShowMenu({ ...showMenu, [postId]: !showMenu[postId] });
    };

    const handleEditPost = (post) => {
        setEditingPost(post.postId);
        setEditContent(post.content);
        setCurrentMedia(post.mediaUrl);
        setEditMedia(null);
        setRemoveMedia(false);
        setShowMenu({});
    };

    const handleSaveEdit = async (postId) => {
        if (!editContent.trim()) return;

        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("content", editContent);

            if (editMedia) {
                formData.append("media", editMedia);
            } else if (removeMedia) {
                formData.append("removeMedia", "true");
            }

            const res = await axios.put(`/api/posts/${postId}`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data"
                }
            });
            setPosts(posts.map(p => p.postId === postId ? res.data : p));
            setEditingPost(null);
            setEditContent("");
            setEditMedia(null);
            setRemoveMedia(false);
            setCurrentMedia(null);
        } catch (error) {
            console.error("Error editing post:", error);
        }
    };

    const handleCancelEdit = () => {
        setEditingPost(null);
        setEditContent("");
        setEditMedia(null);
        setRemoveMedia(false);
        setCurrentMedia(null);
    };

    const handleRemoveMedia = () => {
        setRemoveMedia(true);
        setCurrentMedia(null);
        setEditMedia(null);
    };

    const confirmDelete = (postId) => {
        setShowDeletePostConfirm(postId);
        setShowMenu({});
    };

    const handleBlockUser = (targetUserId, username) => {
        setShowBlockUserConfirm({ targetUserId, username });
        setShowMenu({});
    };

    const executeBlockUser = async (targetUserId, username) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post("/api/users/block",
                { targetUserId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Remove blocked user's posts from feed
            setPosts(posts.filter(p => p.userId !== targetUserId));
            toast.success(`${username} has been blocked`);
        } catch (error) {
            console.error("Error blocking user:", error);
            toast.error("Failed to block user");
        }
    };

    const scrollToSlide = (postId, direction) => {
        const carousel = carouselRefs.current[postId];
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

    const handleScroll = (postId, mediaLength) => {
        const carousel = carouselRefs.current[postId];
        if (!carousel) return;

        const slideWidth = carousel.offsetWidth;
        const currentIndex = Math.round(carousel.scrollLeft / slideWidth);
        setCurrentSlide(prev => ({ ...prev, [postId]: currentIndex }));
    };

    const openFullscreen = (media, index = 0) => {
        // Works on all devices now with enhanced viewer
        setFullscreenMedia(media);
        setFullscreenIndex(index);
    };

    const closeFullscreen = () => {
        setFullscreenMedia(null);
        setFullscreenIndex(0);
    };

    const navigateFullscreen = (direction) => {
        if (!fullscreenMedia) return;
        const newIndex = direction === 'next'
            ? Math.min(fullscreenIndex + 1, fullscreenMedia.length - 1)
            : Math.max(fullscreenIndex - 1, 0);
        setFullscreenIndex(newIndex);
    };

    const openViewer = (mediaItems, index = 0, post) => {
        console.log('🖼️ Opening image viewer:', { mediaItems, index, post });
        setViewerImages(mediaItems || []);
        setViewerIndex(index);
        if (post) {
            setViewerPostData({
                username: post.username,
                userAvatar: userAvatars[post.userId] || post.userAvatar,
                content: post.content,
                likes: post.likes,
                comments: post.comments
            });
        } else {
            setViewerPostData(null);
        }
        setIsViewerOpen(true);
    };

    const closeViewer = () => {
        setIsViewerOpen(false);
        setViewerImages([]);
        setViewerPostData(null);
        setViewerIndex(0);
    };

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!fullscreenMedia) return;
            if (e.key === 'Escape') closeFullscreen();
            if (e.key === 'ArrowLeft') navigateFullscreen('prev');
            if (e.key === 'ArrowRight') navigateFullscreen('next');
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [fullscreenMedia, fullscreenIndex]);

    return (
        <div className="min-h-screen md:pl-72 pt-4 pb-20 md:pb-4 md:pr-4 dark:bg-dark bg-gray-100 scroll-optimized" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Header with Notification Icon */}
                <div className="flex justify-between items-center px-4 md:px-0">
                    <h1 className="text-2xl font-bold dark:text-white text-gray-900">Feed</h1>
                    <div className="relative flex items-center gap-2">
                        {/* Refresh Feed Button */}
                        <button
                            onClick={() => fetchPosts(true)}
                            disabled={loading}
                            className="p-2 text-gray-400 dark:hover:text-white hover:text-gray-900 transition-colors rounded-full hover:bg-white/5 disabled:opacity-50"
                            title="Refresh feed (new order)"
                        >
                            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>

                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative p-2 text-gray-400 dark:hover:text-white hover:text-gray-900 transition-colors rounded-full hover:bg-white/5"
                        >
                            <Bell className="w-6 h-6" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-5 h-5 bg-secondary rounded-full text-white text-xs flex items-center justify-center font-bold">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Notifications - Mobile Bottom Sheet / Desktop Dropdown */}
                        <AnimatePresence>
                            {showNotifications && (
                                <>
                                    {/* Mobile Backdrop */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowNotifications(false)}
                                        className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[99]"
                                    />

                                    {/* Mobile Bottom Sheet / Desktop Dropdown */}
                                    <motion.div
                                        initial={{ opacity: 0, y: window.innerWidth < 768 ? "100%" : -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: window.innerWidth < 768 ? "100%" : -10 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        className="fixed md:absolute inset-x-0 bottom-0 md:bottom-auto md:inset-x-auto md:right-0 md:mt-2 md:w-96 glass-panel md:rounded-xl rounded-t-3xl shadow-2xl border dark:border-white/10 border-gray-200 overflow-hidden z-[100] max-h-[80vh] md:max-h-[500px]"
                                    >
                                        {/* Swipe Indicator (Mobile) */}
                                        <div className="md:hidden w-10 h-1 bg-gray-400 rounded-full mx-auto mt-3" />

                                        {/* Header */}
                                        <div className="flex items-center justify-between p-4 border-b dark:border-white/10 border-gray-200">
                                            <h3 className="font-bold dark:text-white text-gray-900 text-lg">Notifications</h3>
                                            <div className="flex items-center gap-2">
                                                {notifications.length > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowClearConfirm(true);
                                                        }}
                                                        className="text-xs dark:text-gray-400 text-gray-600 dark:hover:text-red-400 hover:text-red-600 flex items-center gap-1.5 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        <span className="hidden sm:inline">Clear All</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setShowNotifications(false)}
                                                    className="dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 p-2 rounded-lg hover:bg-white/10"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Notifications List */}
                                        <div className="overflow-y-auto scrollbar-smooth max-h-[60vh] md:max-h-[400px]">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center dark:text-gray-500 text-gray-600">
                                                    <Bell className="w-16 h-16 mx-auto mb-3 opacity-30" />
                                                    <p className="font-medium">No notifications</p>
                                                    <p className="text-sm mt-1 opacity-70">You're all caught up!</p>
                                                </div>
                                            ) : (
                                                <div className="divide-y dark:divide-white/10 divide-gray-200">
                                                    {notifications.map((notification, index) => {
                                                        const getNotificationIcon = () => {
                                                            switch (notification.type) {
                                                                case "like": return <Heart className="w-4 h-4 text-red-500" fill="currentColor" />;
                                                                case "comment": return <MessageCircle className="w-4 h-4 text-blue-500" />;
                                                                case "follow": return <UserX className="w-4 h-4 text-green-500" />;
                                                                case "message": return <MessageCircle className="w-4 h-4 text-primary" fill="currentColor" />;
                                                                default: return <Bell className="w-4 h-4 text-gray-500" />;
                                                            }
                                                        };

                                                        const getNotificationText = () => {
                                                            switch (notification.type) {
                                                                case "like": return "liked your post";
                                                                case "comment": return notification.message ? `commented: "${notification.message.slice(0, 30)}${notification.message.length > 30 ? '...' : ''}"` : "commented on your post";
                                                                case "follow": return "started following you";
                                                                case "message": return notification.message ? `"${notification.message.slice(0, 30)}${notification.message.length > 30 ? '...' : ''}"` : "sent you a message";
                                                                default: return notification.message || "";
                                                            }
                                                        };

                                                        const getTimeAgo = (date) => {
                                                            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
                                                            if (seconds < 60) return 'Just now';
                                                            const minutes = Math.floor(seconds / 60);
                                                            if (minutes < 60) return `${minutes}m ago`;
                                                            const hours = Math.floor(minutes / 60);
                                                            if (hours < 24) return `${hours}h ago`;
                                                            const days = Math.floor(hours / 24);
                                                            if (days < 7) return `${days}d ago`;
                                                            return new Date(date).toLocaleDateString();
                                                        };

                                                        return (
                                                            <motion.div
                                                                key={notification.notificationId}
                                                                initial={{ opacity: 0, x: -20 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: index * 0.05 }}
                                                                onClick={() => {
                                                                    markAsRead(notification.notificationId);
                                                                    if (notification.type === "message") {
                                                                        navigate("/chat");
                                                                    } else if (notification.type === "follow") {
                                                                        navigate(`/profile/${notification.fromUserId}`);
                                                                    }
                                                                    setShowNotifications(false);
                                                                }}
                                                                className={`p-4 cursor-pointer transition-all active:scale-[0.98] ${notification.read
                                                                        ? "dark:bg-transparent bg-white"
                                                                        : "dark:bg-primary/10 bg-primary/5"
                                                                    } dark:hover:bg-white/5 hover:bg-gray-50`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div className="relative">
                                                                        <SafeAvatar
                                                                            src={notification.fromUserAvatar}
                                                                            alt={notification.fromUsername}
                                                                            fallbackText={notification.fromUsername || "U"}
                                                                            className="w-12 h-12 rounded-full flex-shrink-0"
                                                                        />
                                                                        <div className="absolute -bottom-1 -right-1 p-1 rounded-full dark:bg-dark bg-white shadow-sm">
                                                                            {getNotificationIcon()}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="dark:text-white text-gray-900 text-sm leading-snug">
                                                                            <span className="font-semibold">{notification.fromUsername}</span>
                                                                            {" "}
                                                                            <span className="dark:text-gray-400 text-gray-600">
                                                                                {getNotificationText()}
                                                                            </span>
                                                                        </p>
                                                                        <p className="text-xs dark:text-gray-500 text-gray-500 mt-1">
                                                                            {getTimeAgo(notification.createdAt)}
                                                                        </p>
                                                                    </div>
                                                                    {!notification.read && (
                                                                        <div className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0 mt-1 animate-pulse"></div>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Mobile Safe Area */}
                                        <div className="md:hidden h-6 safe-bottom" />
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Create Post Widget - Only show for logged in users */}
                {user ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel p-4"
                    >
                        <form onSubmit={handlePostSubmit}>
                            <div className="flex gap-4">
                                <SafeAvatar
                                    src={user?.avatar}
                                    alt="Avatar"
                                    fallbackText={user?.username || 'User'}
                                    className="w-10 h-10 rounded-full"
                                />
                                <div className="flex-1">
                                    <textarea
                                        placeholder="What's on your mind?"
                                        className="w-full bg-transparent dark:text-white text-gray-900 placeholder-gray-400 resize-none focus:outline-none min-h-[60px]"
                                        value={newPost}
                                        onChange={(e) => setNewPost(e.target.value)}
                                    />
                                    {media.length > 0 && (
                                        <div className="mt-2 relative rounded-xl overflow-hidden bg-black">
                                            {media.length === 1 ? (
                                                // Single media preview
                                                <div className="relative">
                                                    {media[0].type.startsWith('video') ? (
                                                        <video src={URL.createObjectURL(media[0])} className="w-full max-h-96 object-contain" />
                                                    ) : (
                                                        <img src={URL.createObjectURL(media[0])} alt="Preview" className="w-full max-h-96 object-contain" />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setMedia([])}
                                                        className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-2 text-white hover:bg-black/80 transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                // Multiple media preview with carousel
                                                <div className="relative">
                                                    <div className="overflow-x-auto snap-x snap-mandatory flex scrollbar-hide">
                                                        {media.map((file, index) => (
                                                            <div key={index} className="w-full flex-shrink-0 snap-center relative">
                                                                {file.type.startsWith('video') ? (
                                                                    <video src={URL.createObjectURL(file)} className="w-full max-h-96 object-contain" />
                                                                ) : (
                                                                    <img src={URL.createObjectURL(file)} alt={`Preview ${index + 1}`} className="w-full max-h-96 object-contain" />
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setMedia(media.filter((_, i) => i !== index))}
                                                                    className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-2 text-white hover:bg-black/80 transition-colors"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* Counter Badge */}
                                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                                                        {media.length} {media.length === 1 ? 'item' : 'items'}
                                                    </div>
                                                    {/* Dots Indicator */}
                                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                                        {media.map((_, index) => (
                                                            <div
                                                                key={index}
                                                                className="w-1.5 h-1.5 rounded-full bg-white/60"
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Poll Options */}
                                    {showPollForm && (
                                        <div className="mt-4 space-y-2 p-4 dark:bg-dark-lighter bg-gray-100 rounded-xl">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm dark:text-gray-400 text-gray-600">Poll Options</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPollForm(false)}
                                                    className="dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {pollOptions.map((opt, index) => (
                                                <input
                                                    key={index}
                                                    type="text"
                                                    placeholder={`Option ${index + 1}`}
                                                    className="input-field w-full"
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newOpts = [...pollOptions];
                                                        newOpts[index] = e.target.value;
                                                        setPollOptions(newOpts);
                                                    }}
                                                />
                                            ))}
                                            {pollOptions.length < 4 && (
                                                <button
                                                    type="button"
                                                    onClick={addPollOption}
                                                    className="text-primary hover:text-primary-hover text-sm"
                                                >
                                                    + Add option
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                                        <div className="flex gap-2">
                                            <label className="cursor-pointer text-primary hover:text-primary-hover transition-colors p-2 rounded-lg hover:bg-white/5">
                                                <Paperclip className="w-5 h-5" />
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*,video/*"
                                                    multiple
                                                    onChange={(e) => {
                                                        const files = Array.from(e.target.files);
                                                        if (files.length > 0) {
                                                            setMedia(prev => [...prev, ...files]);
                                                        }
                                                    }}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowPollForm(!showPollForm)}
                                                className={`p-2 rounded-lg transition-colors ${showPollForm ? 'text-secondary bg-secondary/10' : 'text-primary hover:text-primary-hover hover:bg-white/5'}`}
                                            >
                                                <BarChart2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={uploading || (!newPost && media.length === 0 && !showPollForm)}
                                            className="btn-primary py-1.5 px-4 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {uploading ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Posting...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    Post
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                        {/* Shadcn-style Upload Progress */}
                        <UploadProgress
                            isUploading={uploading}
                            progress={uploadProgress}
                            isSuccess={uploadSuccess}
                            stage={uploadStage}
                        />
                    </motion.div>
                ) : (
                    /* Login Prompt for non-logged-in users */
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel p-6 text-center"
                    >
                        <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">
                            Join the conversation!
                        </h3>
                        <p className="dark:text-gray-400 text-gray-600 mb-4">
                            Login or sign up to create posts, like, comment, and connect with others.
                        </p>
                        <button
                            onClick={() => navigate("/login")}
                            className="btn-primary py-2 px-6"
                        >
                            Login / Sign Up
                        </button>
                    </motion.div>
                )}

                {/* Feed */}
                <div className="space-y-6">
                    {loading ? (
                        // Hamster Loading Animation
                        <div className="flex flex-col items-center justify-center py-16">
                            <HamsterLoader size="large" text="Loading posts..." />
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="glass-panel p-8 text-center">
                            <p className="dark:text-gray-400 text-gray-600">No posts yet. Be the first to post!</p>
                        </div>
                    ) : (
                        posts.map((post, index) => (
                            <div
                                key={post.postId}
                                data-post-id={post.postId}
                                className="glass-panel p-4 scroll-item"
                                style={{ contain: 'layout style paint' }}
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <SafeAvatar
                                        src={userAvatars[post.userId] || post.userAvatar}
                                        alt={post.username}
                                        fallbackText={post.username}
                                        className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => navigate(`/profile/${post.userId}`)}
                                        onError={(e) => {
                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.username)}&background=random`;
                                        }}
                                    />
                                    <div className="flex-1">
                                        <h3
                                            onClick={() => navigate(`/profile/${post.userId}`)}
                                            className="font-bold dark:text-white text-gray-900 cursor-pointer hover:text-primary transition-colors"
                                        >
                                            {post.username}
                                        </h3>
                                        <p className="text-xs dark:text-gray-400 text-gray-600">
                                            {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Unknown date'}
                                            {post.editedAt && <span className="ml-2">(edited)</span>}
                                        </p>
                                    </div>

                                    {/* Three-dot menu */}
                                    <div className="relative">
                                        <button
                                            onClick={() => toggleMenu(post.postId)}
                                            className="p-2 dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 rounded-full dark:hover:bg-white/10 hover:bg-gray-100 transition-colors"
                                        >
                                            <MoreVertical className="w-5 h-5" />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {showMenu[post.postId] && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="absolute right-0 mt-2 w-48 dark:bg-[#202c33] bg-white rounded-lg shadow-lg border dark:border-white/10 border-gray-200 z-50"
                                            >
                                                {post.userId === user?.userId ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleEditPost(post)}
                                                            className="w-full flex items-center gap-3 px-4 py-3 dark:text-white text-gray-900 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors rounded-t-lg"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                            <span>Edit Post</span>
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDelete(post.postId)}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors rounded-b-lg"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            <span>Delete Post</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleBlockUser(post.userId, post.username)}
                                                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors rounded-lg"
                                                    >
                                                        <UserX className="w-4 h-4" />
                                                        <span>Block {post.username}</span>
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                {/* Post Content - Editable if editing */}
                                {editingPost === post.postId ? (
                                    <div className="mb-4 space-y-3">
                                        <textarea
                                            className="input-field w-full min-h-[100px]"
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            placeholder="What's on your mind?"
                                            autoFocus
                                        />

                                        {/* Current/New Media Preview */}
                                        {(currentMedia || editMedia) && !removeMedia && (
                                            <div className="relative rounded-xl overflow-hidden bg-black">
                                                <RetryImage
                                                    src={editMedia ? URL.createObjectURL(editMedia) : currentMedia}
                                                    alt="Media preview"
                                                    className="w-full max-h-60 object-contain"
                                                />
                                                <button
                                                    onClick={handleRemoveMedia}
                                                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Media Upload Options */}
                                        <div className="flex items-center gap-2">
                                            <label className="cursor-pointer text-primary hover:text-primary-hover transition-colors p-2 rounded-lg hover:bg-white/5 flex items-center gap-2">
                                                <Paperclip className="w-5 h-5" />
                                                <span className="text-sm">{editMedia ? 'Change Media' : currentMedia && !removeMedia ? 'Replace Media' : 'Add Media'}</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*,video/*"
                                                    onChange={(e) => {
                                                        setEditMedia(e.target.files[0]);
                                                        setRemoveMedia(false);
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={handleCancelEdit}
                                                className="px-4 py-2 dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleSaveEdit(post.postId)}
                                                className="btn-primary px-4 py-2"
                                                disabled={!editContent.trim()}
                                            >
                                                Save Changes
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="dark:text-gray-200 text-gray-800 mb-4 whitespace-pre-wrap">{post.content}</p>
                                )}

                                {/* Instagram-Style Media Carousel */}
                                {post.media && post.media.length > 0 && (
                                    <div className="mb-4 relative rounded-xl overflow-hidden group">
                                        {post.media.length === 1 ? (
                                            // Single media - Instagram frame with sensitive content wrapper
                                            <SensitiveMediaWrapper isSensitive={post.media[0].isNsfw}>
                                                <InstagramMediaFrame
                                                    media={post.media[0]}
                                                    postId={post.postId}
                                                    onDelete={handleDeletePost}
                                                    onDoubleClick={() => openFullscreen(post.media, 0)}
                                                    onClick={() => openViewer(post.media, 0, post)}
                                                />
                                            </SensitiveMediaWrapper>
                                        ) : (
                                            // Multiple media - carousel with counter and arrows
                                            <div className="relative">
                                                <div
                                                    ref={(el) => carouselRefs.current[post.postId] = el}
                                                    onScroll={() => handleScroll(post.postId, post.media.length)}
                                                    className="overflow-x-auto snap-x snap-mandatory flex scrollbar-hide"
                                                >
                                                    {post.media.map((mediaItem, index) => (
                                                        <div
                                                            key={index}
                                                            className="w-full flex-shrink-0 snap-center cursor-pointer"
                                                            onDoubleClick={() => openFullscreen(post.media, index)}
                                                        >
                                                            <SensitiveMediaWrapper isSensitive={mediaItem.isNsfw}>
                                                                <InstagramMediaFrame
                                                                    media={mediaItem}
                                                                    postId={post.postId}
                                                                    onDelete={handleDeletePost}
                                                                    onDoubleClick={() => openFullscreen(post.media, index)}
                                                                    onClick={() => openViewer(post.media, index, post)}
                                                                />
                                                            </SensitiveMediaWrapper>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Counter Badge - Instagram Style */}
                                                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                                                    {(currentSlide[post.postId] || 0) + 1}/{post.media.length}
                                                </div>

                                                {/* Dots Indicator */}
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                                    {post.media.map((_, index) => (
                                                        <div
                                                            key={index}
                                                            className={`w-1.5 h-1.5 rounded-full transition-all ${index === (currentSlide[post.postId] || 0)
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

                                {/* Backward compatibility for old posts with single media */}
                                {post.mediaUrl && !post.media && (
                                    <div className="mb-4">
                                        <SensitiveMediaWrapper isSensitive={post.isNsfw}>
                                            <InstagramMediaFrame
                                                media={{ url: post.mediaUrl, type: post.mediaType }}
                                                postId={post.postId}
                                                onDelete={handleDeletePost}
                                                onDoubleClick={() => openFullscreen([{ url: post.mediaUrl, type: post.mediaType }], 0)}
                                                onClick={() => openViewer([{ url: post.mediaUrl, type: post.mediaType }], 0, post)}
                                            />
                                        </SensitiveMediaWrapper>
                                    </div>
                                )}

                                {/* Poll Display */}
                                {post.poll && (
                                    <div className="mb-4 space-y-2">
                                        {post.poll.options.map((option) => {
                                            const totalVotes = post.poll.options.reduce((sum, opt) => sum + opt.votes, 0);
                                            const percentage = totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(1) : 0;
                                            const hasVoted = user ? option.voters.includes(user.userId) : false;

                                            return (
                                                <button
                                                    key={option.id}
                                                    onClick={() => handleVote(post.postId, option.id)}
                                                    disabled={user ? post.poll.options.some(opt => opt.voters.includes(user.userId)) : true}
                                                    className="w-full p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all relative overflow-hidden disabled:cursor-not-allowed"
                                                >
                                                    <div
                                                        className="absolute left-0 top-0 h-full bg-primary/20 transition-all"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                    <div className="relative flex justify-between items-center">
                                                        <span className={`text-left ${hasVoted ? 'font-bold text-primary' : 'dark:text-gray-200 text-gray-800'}`}>
                                                            {option.text}
                                                        </span>
                                                        <span className="text-sm dark:text-gray-400 text-gray-600">{percentage}% ({option.votes})</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Post Actions */}
                                <div className="flex items-center gap-6 dark:text-gray-400 text-gray-600 pt-4 border-t dark:border-white/10 border-gray-200">
                                    <button
                                        onClick={() => handleLike(post.postId)}
                                        className={`flex items-center gap-2 hover:text-secondary transition-colors ${user && post.likedBy?.includes(user.userId) ? 'text-secondary' : ''
                                            }`}
                                    >
                                        <Heart className={`w-5 h-5 ${user && post.likedBy?.includes(user.userId) ? 'fill-current' : ''}`} />
                                        <span>{post.likes || 0}</span>
                                    </button>
                                    <button
                                        onClick={() => toggleComments(post.postId)}
                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                        <span>{post.comments?.length || 0}</span>
                                    </button>
                                    <button
                                        onClick={() => handleShare(post.postId)}
                                        className="flex items-center gap-2 dark:hover:text-white hover:text-gray-900 transition-colors"
                                    >
                                        <Share2 className="w-5 h-5" />
                                        <span>{post.shares || 0}</span>
                                    </button>
                                    <button
                                        onClick={() => handleSave(post.postId)}
                                        className={`flex items-center gap-2 hover:text-primary transition-colors ${user && post.savedBy?.includes(user.userId) ? 'text-primary' : ''
                                            }`}
                                    >
                                        <Bookmark className={`w-5 h-5 ${user && post.savedBy?.includes(user.userId) ? 'fill-current' : ''}`} />
                                    </button>
                                    <div className="flex items-center gap-1 text-xs ml-auto">
                                        <Eye className="w-4 h-4" />
                                        <span>{post.views || 0}</span>
                                    </div>
                                </div>

                                {/* Comments Section */}
                                {showComments[post.postId] && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-4 space-y-3"
                                    >
                                        {/* Comment Input */}
                                        <div className="flex gap-2">
                                            <SafeAvatar
                                                src={user?.avatar}
                                                alt="Your avatar"
                                                fallbackText={user?.username || 'User'}
                                                className="w-8 h-8 rounded-full"
                                                onError={(e) => {
                                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}&background=random`;
                                                }}
                                            />
                                            <div className="flex-1 flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Write a comment..."
                                                    className="input-field flex-1 py-2"
                                                    value={commentText[post.postId] || ""}
                                                    onChange={(e) => setCommentText({ ...commentText, [post.postId]: e.target.value })}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleComment(post.postId)}
                                                />
                                                <button
                                                    onClick={() => handleComment(post.postId)}
                                                    className="btn-primary py-2 px-4"
                                                    disabled={!commentText[post.postId]?.trim()}
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Comments List - Newest First */}
                                        <div className="space-y-3 max-h-60 overflow-y-auto scrollbar-smooth">
                                            {post.comments?.length > 0 ? (
                                                post.comments.map((comment, index) => (
                                                    <motion.div
                                                        key={comment.commentId}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        className="flex gap-2"
                                                    >
                                                        <SafeAvatar
                                                            src={comment.userAvatar}
                                                            alt={comment.username}
                                                            fallbackText={comment.username}
                                                            className="w-8 h-8 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                                                            onClick={() => navigate(`/profile/${comment.userId}`)}
                                                            onError={(e) => {
                                                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username)}&background=random`;
                                                            }}
                                                        />
                                                        <div className="flex-1 dark:bg-white/5 bg-gray-100 rounded-lg p-3 relative">
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    <span
                                                                        className="font-semibold dark:text-white text-gray-900 text-sm cursor-pointer hover:text-primary transition-colors"
                                                                        onClick={() => navigate(`/profile/${comment.userId}`)}
                                                                    >
                                                                        {comment.username}
                                                                    </span>
                                                                    <span className="text-xs dark:text-gray-500 text-gray-600">
                                                                        {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown time'}
                                                                    </span>
                                                                    {comment.editedAt && (
                                                                        <span className="text-xs dark:text-gray-500 text-gray-600">(edited)</span>
                                                                    )}
                                                                    {post.pinnedCommentId === comment.commentId && (
                                                                        <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                            <Pin className="w-3 h-3" />
                                                                            Pinned
                                                                        </span>
                                                                    )}
                                                                    {index === 0 && !post.pinnedCommentId && (
                                                                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                                                            Latest
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Comment Menu */}
                                                                {(comment.userId === user?.userId || post.userId === user?.userId) && (
                                                                    <div className="relative">
                                                                        <button
                                                                            onClick={() => toggleCommentMenu(post.postId, comment.commentId)}
                                                                            className="p-1 dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 rounded-full dark:hover:bg-white/10 hover:bg-gray-200 transition-colors"
                                                                        >
                                                                            <MoreVertical className="w-4 h-4" />
                                                                        </button>

                                                                        {showCommentMenu[`${post.postId}-${comment.commentId}`] && (
                                                                            <motion.div
                                                                                initial={{ opacity: 0, scale: 0.95 }}
                                                                                animate={{ opacity: 1, scale: 1 }}
                                                                                className="absolute right-0 mt-1 w-40 dark:bg-[#202c33] bg-white rounded-lg shadow-lg border dark:border-white/10 border-gray-200 z-50"
                                                                            >
                                                                                {comment.userId === user?.userId && (
                                                                                    <button
                                                                                        onClick={() => handleEditComment(post.postId, comment)}
                                                                                        className="w-full flex items-center gap-2 px-3 py-2 dark:text-white text-gray-900 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors rounded-t-lg text-sm"
                                                                                    >
                                                                                        <Edit2 className="w-4 h-4" />
                                                                                        <span>Edit</span>
                                                                                    </button>
                                                                                )}
                                                                                {post.userId === user?.userId && (
                                                                                    <button
                                                                                        onClick={() => handlePinComment(post.postId, comment.commentId)}
                                                                                        className="w-full flex items-center gap-2 px-3 py-2 dark:text-white text-gray-900 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors text-sm"
                                                                                    >
                                                                                        <Pin className="w-4 h-4" />
                                                                                        <span>{post.pinnedCommentId === comment.commentId ? 'Unpin' : 'Pin'}</span>
                                                                                    </button>
                                                                                )}
                                                                                {(comment.userId === user?.userId || post.userId === user?.userId) && (
                                                                                    <button
                                                                                        onClick={() => handleDeleteComment(post.postId, comment.commentId)}
                                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-red-500 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors rounded-b-lg text-sm"
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                        <span>Delete</span>
                                                                                    </button>
                                                                                )}
                                                                            </motion.div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Comment Content - Editable */}
                                                            {editingComment === `${post.postId}-${comment.commentId}` ? (
                                                                <div className="space-y-2">
                                                                    <input
                                                                        type="text"
                                                                        value={editCommentText}
                                                                        onChange={(e) => setEditCommentText(e.target.value)}
                                                                        className="input-field w-full text-sm"
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex gap-2 justify-end">
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingComment(null);
                                                                                setEditCommentText("");
                                                                            }}
                                                                            className="text-xs px-3 py-1 dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleSaveCommentEdit(post.postId, comment.commentId)}
                                                                            className="text-xs px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-1"
                                                                            disabled={!editCommentText.trim()}
                                                                        >
                                                                            <Check className="w-3 h-3" />
                                                                            Save
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="dark:text-gray-300 text-gray-800 text-sm">{comment.content}</p>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))
                                            ) : (
                                                <p className="text-center dark:text-gray-500 text-gray-600 text-sm py-4">
                                                    No comments yet. Be the first to comment!
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Enhanced Fullscreen Media Viewer - Works on ALL devices */}
            <InstagramImageViewer
                isOpen={fullscreenMedia !== null}
                onClose={closeFullscreen}
                images={fullscreenMedia || []}
                initialIndex={fullscreenIndex}
                postData={null}
            />

            {/* Instagram-style Image Viewer */}
            <InstagramImageViewer
                isOpen={isViewerOpen}
                onClose={closeViewer}
                images={viewerImages}
                initialIndex={viewerIndex}
                postData={viewerPostData}
            />

            {/* Upload Progress Indicator */}
            <AnimatePresence>
                {uploading && (
                    <LoadingIndicator
                        message={uploadSuccess ? "Post created successfully!" : "Uploading post..."}
                        progress={uploadProgress}
                        success={uploadSuccess}
                    />
                )}
            </AnimatePresence>

            {/* Shadcn-style Clear Notifications Dialog */}
            <AlertDialog
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={async () => {
                    try {
                        await clearAll();
                        setShowClearConfirm(false);
                        setShowNotifications(false);
                    } catch (error) {
                        console.error("Error clearing notifications:", error);
                    }
                }}
                title="Clear All Notifications?"
                description="Are you sure you want to clear all notifications? This cannot be undone."
                confirmText="Clear All"
                cancelText="Cancel"
                variant="destructive"
            />

            {/* Shadcn-style Delete Post Dialog */}
            <AlertDialog
                isOpen={!!showDeletePostConfirm}
                onClose={() => setShowDeletePostConfirm(null)}
                onConfirm={async () => {
                    if (showDeletePostConfirm) {
                        await handleDeletePost(showDeletePostConfirm);
                        setShowDeletePostConfirm(null);
                    }
                }}
                title="Delete Post?"
                description="Are you sure you want to delete this post? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
            />

            {/* Shadcn-style Delete Comment Dialog */}
            <AlertDialog
                isOpen={!!showDeleteCommentConfirm}
                onClose={() => setShowDeleteCommentConfirm(null)}
                onConfirm={async () => {
                    if (showDeleteCommentConfirm) {
                        await executeDeleteComment(showDeleteCommentConfirm.postId, showDeleteCommentConfirm.commentId);
                        setShowDeleteCommentConfirm(null);
                    }
                }}
                title="Delete Comment?"
                description="Are you sure you want to delete this comment?"
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
            />

            {/* Shadcn-style Block User Dialog */}
            <AlertDialog
                isOpen={!!showBlockUserConfirm}
                onClose={() => setShowBlockUserConfirm(null)}
                onConfirm={async () => {
                    if (showBlockUserConfirm) {
                        await executeBlockUser(showBlockUserConfirm.targetUserId, showBlockUserConfirm.username);
                        setShowBlockUserConfirm(null);
                    }
                }}
                title={`Block ${showBlockUserConfirm?.username || 'User'}?`}
                description="You won't see their posts anymore. You can unblock them later from Settings."
                confirmText="Block"
                cancelText="Cancel"
                variant="warning"
            />

            {/* Login Prompt Modal */}
            <LoginPrompt
                isOpen={showLoginPrompt}
                onClose={() => setShowLoginPrompt(false)}
                message={loginPromptMessage}
            />
        </div>
    );
};

export default Home;
