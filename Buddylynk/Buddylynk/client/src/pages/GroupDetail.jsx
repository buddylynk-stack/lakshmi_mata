import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Send, Paperclip, Image as ImageIcon, BarChart3, X, Smile, Plus, MoreVertical, Edit2, Trash2, Eye, Grid3X3, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { SafeImage } from "../components/SafeImage";
import ConfirmModal from "../components/ConfirmModal";
import ChannelInfo from "../components/ChannelInfo";
import VideoPlayer from "../components/VideoPlayer";
import SensitiveMediaWrapper from "../components/SensitiveMediaWrapper";
import { containerVariants, itemVariants, scaleVariants, slideUpVariants, fastTransition } from "../utils/animations";
import axios from "axios";

const GroupDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { socket, on, off } = useSocket();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newPost, setNewPost] = useState("");
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showPollModal, setShowPollModal] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState([]);
    const [mediaPreviews, setMediaPreviews] = useState([]);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [editingPostId, setEditingPostId] = useState(null);
    const [editingContent, setEditingContent] = useState("");
    const [showPostMenu, setShowPostMenu] = useState(null);
    const [showGroupMenu, setShowGroupMenu] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);
    const [showChannelInfo, setShowChannelInfo] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const [showMediaOptionsMenu, setShowMediaOptionsMenu] = useState(false);
    const [showMediaPreviewModal, setShowMediaPreviewModal] = useState(false);
    const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const toast = useToast();

    useEffect(() => {
        fetchGroup();
    }, [id]);

    // Real-time group updates
    useEffect(() => {
        if (!socket || !id) return;

        const handleGroupUpdated = (data) => {
            if (data.groupId === id) {
                console.log("🔄 Group updated in real-time:", id, "Action:", data.action);
                setGroup(data.group);
            }
        };

        const handleGroupDeleted = (deletedGroupId) => {
            if (deletedGroupId === id) {
                console.log("🗑️ Group deleted, redirecting...");
                navigate("/groups");
            }
        };

        on("groupUpdated", handleGroupUpdated);
        on("groupDeleted", handleGroupDeleted);

        return () => {
            off("groupUpdated", handleGroupUpdated);
            off("groupDeleted", handleGroupDeleted);
        };
    }, [socket, id, on, off, navigate]);

    useEffect(() => {
        scrollToBottom();
    }, [group?.posts]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchGroup = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/groups/${id}`);
            setGroup(res.data);
        } catch (error) {
            console.error("Error fetching group:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePostSubmit = async (e) => {
        e.preventDefault();
        if (!newPost.trim() && selectedMedia.length === 0) return;
        if (isSending) return; // Prevent duplicate submissions

        const messageContent = newPost;
        setIsSending(true);
        
        // Optimistic update - add message immediately to UI
        const tempPost = {
            postId: `temp-${Date.now()}`,
            userId: user.userId,
            username: user.username,
            content: messageContent,
            createdAt: new Date().toISOString(),
            sending: true
        };
        
        // Add temp message to group posts immediately (no page refresh)
        if (selectedMedia.length === 0) {
            setGroup(prev => ({
                ...prev,
                posts: [...(prev.posts || []), tempPost]
            }));
            setNewPost(""); // Clear input immediately
        }
        
        try {
            const token = localStorage.getItem("token");
            
            // Text-only post (no media)
            if (selectedMedia.length === 0) {
                const res = await axios.post(`/api/groups/${id}/posts`, 
                    { content: messageContent },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                // Replace temp post with real one from response (WebSocket will also update)
                // No fetchGroup() needed - WebSocket handles real-time sync
                return;
            }
            
            // Media post
            const MAX_FILES_PER_POST = 20;
            const fileChunks = [];
            for (let i = 0; i < selectedMedia.length; i += MAX_FILES_PER_POST) {
                fileChunks.push(selectedMedia.slice(i, i + MAX_FILES_PER_POST));
            }
            
            for (let i = 0; i < fileChunks.length; i++) {
                const chunk = fileChunks[i];
                const formData = new FormData();
                formData.append("content", i === 0 ? messageContent : "");
                chunk.forEach((file) => {
                    formData.append("media", file);
                });

                await axios.post(`/api/groups/${id}/posts`, formData, {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data"
                    }
                });
            }
            
            if (fileChunks.length > 1) {
                toast.success(`${selectedMedia.length} files sent in ${fileChunks.length} posts!`);
            }
            
            setNewPost("");
            setSelectedMedia([]);
            setMediaPreviews([]);
            // No fetchGroup() - WebSocket handles real-time sync
        } catch (error) {
            console.error("Error creating post:", error);
            toast.error(error.response?.data?.message || "Failed to send message");
            // Remove temp post on error
            setGroup(prev => ({
                ...prev,
                posts: (prev.posts || []).filter(p => p.postId !== tempPost.postId)
            }));
            setNewPost(messageContent); // Restore message
        } finally {
            setIsSending(false);
        }
    };

    const handleMediaSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            setSelectedMedia(files);
            
            // Create previews for all files
            const previews = files.map(file => {
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    return {
                        type: file.type.startsWith('image/') ? 'image' : 'video',
                        url: URL.createObjectURL(file),
                        name: file.name
                    };
                } else {
                    return {
                        type: 'file',
                        name: file.name
                    };
                }
            });
            
            setMediaPreviews(previews);
            setShowAttachMenu(false);
        }
    };

    const handleCreatePoll = async () => {
        if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
            toast.warning("Please provide a question and at least 2 options");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/groups/${id}/posts`, {
                content: pollQuestion,
                type: "poll",
                pollOptions: pollOptions.filter(o => o.trim())
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setShowPollModal(false);
            setPollQuestion("");
            setPollOptions(["", ""]);
            fetchGroup();
        } catch (error) {
            console.error("Error creating poll:", error);
        }
    };

    const addPollOption = () => {
        setPollOptions([...pollOptions, ""]);
    };

    const removePollOption = (index) => {
        if (pollOptions.length > 2) {
            setPollOptions(pollOptions.filter((_, i) => i !== index));
        }
    };

    const handleEditPost = async (postId) => {
        if (!editingContent.trim()) return;
        try {
            const token = localStorage.getItem("token");
            await axios.put(`/api/groups/${id}/posts/${postId}`, 
                { content: editingContent },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setGroup(prev => ({
                ...prev,
                posts: prev.posts.map(post => 
                    post.postId === postId 
                        ? { ...post, content: editingContent } 
                        : post
                )
            }));
            setEditingPostId(null);
            setEditingContent("");
            setShowPostMenu(null);
        } catch (error) {
            console.error("Error editing post:", error);
        }
    };

    const handleDeletePost = async (postId) => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/groups/${id}/posts/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGroup(prev => ({
                ...prev,
                posts: prev.posts.filter(post => post.postId !== postId)
            }));
            setShowPostMenu(null);
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    };

    const handleDeleteGroup = () => {
        setShowDeleteGroupConfirm(true);
        setShowGroupMenu(false);
    };

    const executeDeleteGroup = async () => {
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/groups/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Group deleted successfully");
            navigate("/groups");
        } catch (error) {
            console.error("Error deleting group:", error);
            toast.error(error.response?.data?.message || "Failed to delete group");
        }
    };

    const handleEditGroup = () => {
        // TODO: Implement edit group functionality
        toast.info("Edit group feature coming soon!");
        // navigate(`/groups/${id}/edit`);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 md:pl-72 flex items-center justify-center dark:bg-dark bg-gray-100">
                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="fixed inset-0 md:pl-72 flex items-center justify-center dark:bg-dark bg-gray-100">
                <p className="dark:text-white text-gray-900">Group not found</p>
            </div>
        );
    }

    const isMember = group.members?.includes(user.userId);
    const isOwner = group.creatorId === user.userId;
    const isAdmin = group.admins?.includes(user.userId);
    
    // Channels: ONLY admin/creator can post (always)
    // Groups: Check allowMembersToChat setting
    const isChannel = group.type === 'channel';
    const allowMembersToChat = group.allowMembersToChat !== false;
    
    // For channels: only owner/admins can post
    // For groups: depends on allowMembersToChat setting
    const canPost = isChannel ? (isOwner || isAdmin) : (allowMembersToChat ? isMember : (isOwner || isAdmin));

    return (
        <div className="fixed inset-0 md:pl-72 dark:bg-[#0b141a] bg-gray-100 flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* WhatsApp-Style Header - Clickable to open Channel Info */}
            <div className="dark:bg-[#202c33] bg-white px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 border-b dark:border-[#2a3942] border-gray-200 z-10 flex-shrink-0">
                <button
                    onClick={() => navigate("/groups")}
                    className="dark:text-[#aebac1] text-gray-600 dark:hover:text-white hover:text-gray-900 p-1"
                >
                    <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                
                {/* Clickable Header Area - Opens Channel Info */}
                <div 
                    className="flex items-center gap-2 sm:gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowChannelInfo(true)}
                >
                    {group.coverImage ? (
                        <SafeImage
                            src={group.coverImage}
                            alt={group.name}
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                    )}
                    
                    <div className="flex-1">
                        <h3 className="font-medium dark:text-white text-gray-900">{group.name}</h3>
                        <p className="text-xs dark:text-[#8696a0] text-gray-600">
                            {group.memberCount} {group.memberCount === 1 ? 'subscriber' : 'subscribers'}
                        </p>
                    </div>
                </div>


            </div>

            {/* Messages Area with WhatsApp Background Pattern - Optimized for mobile scroll */}
            <div 
                className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4 space-y-3 scroll-optimized"
                style={{
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
            >
                {/* Show messages for public channels (or if member) */}
                {group.posts && group.posts.length > 0 ? (
                    [...group.posts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map((post) => {
                        const isOwn = post.userId === user.userId;
                        
                        return (
                            <div
                                key={post.postId}
                                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group relative scroll-item`}
                                style={{ contain: 'layout style paint' }}
                            >
                                <div className="relative">
                                <div className={`max-w-[100vw] sm:max-w-[100vw] md:max-w-[100vw] lg:max-w-[100vw] px-3 py-2 rounded-2xl backdrop-blur-xl shadow-lg border ${
                                    isOwn 
                                        ? 'bg-white/10 dark:bg-white/10 text-black dark:text-white rounded-br-none border-white/20 dark:border-white/20' 
                                        : 'dark:bg-white/5 bg-white/70 dark:text-white text-black rounded-bl-none dark:border-white/10 border-gray-200/50'
                                }`}>
                                    {!isOwn && (
                                        <p className="text-xs font-semibold text-primary mb-1">{post.username}</p>
                                    )}
                                    
                                    {post.media && (
                                        <div className="mb-2 rounded-xl">
                                            {Array.isArray(post.media) ? (
                                                // Magic Frame Layout - preserves natural aspect ratios
                                                post.media.length === 1 ? (
                                                    // Single media - full width with magic frame
                                                    <SensitiveMediaWrapper isSensitive={post.media[0].isNsfw || post.isNsfw}>
                                                        <div className="w-full">
                                                            {post.media[0].type === 'video' ? (
                                                                <div className="w-full">
                                                                    <VideoPlayer src={post.media[0].url} className="w-full" />
                                                                </div>
                                                            ) : post.media[0].type === 'image' ? (
                                                                <div className="w-full magic-frame-container">
                                                                    <SafeImage 
                                                                        src={post.media[0].url} 
                                                                        alt="Media" 
                                                                        onClick={() => setFullScreenImage(post.media[0].url)} 
                                                                        className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition-all" 
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <a href={post.media[0].url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 transition-colors rounded-lg"><Paperclip className="w-4 h-4" /><span className="truncate">{post.media[0].name || 'File'}</span></a>
                                                            )}
                                                        </div>
                                                    </SensitiveMediaWrapper>
                                                ) : (
                                                    // Multiple media - full width magic frame container
                                                    <div className="w-full magic-frame-container">
                                                        <div className="flex flex-col gap-1 bg-black">
                                                            {post.media.map((mediaItem, idx) => (
                                                                <SensitiveMediaWrapper key={idx} isSensitive={mediaItem.isNsfw || post.isNsfw}>
                                                                    <div className="w-full">
                                                                        {mediaItem.type === 'video' ? (
                                                                            <VideoPlayer src={mediaItem.url} className="w-full" />
                                                                        ) : mediaItem.type === 'image' ? (
                                                                            <SafeImage src={mediaItem.url} alt="Media" onClick={() => setFullScreenImage(mediaItem.url)} className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition-all" />
                                                                        ) : (
                                                                            <a href={mediaItem.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 transition-colors text-sm"><Paperclip className="w-4 h-4" /><span className="truncate">{mediaItem.name || 'File'}</span></a>
                                                                        )}
                                                                    </div>
                                                                </SensitiveMediaWrapper>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                // Old format - single media (backward compatibility)
                                                <SensitiveMediaWrapper isSensitive={post.isNsfw}>
                                                    <div className="flex justify-center">
                                                        {post.mediaType === 'video' || (typeof post.media === 'string' && post.media.includes('.mp4')) ? (
                                                            <VideoPlayer src={post.media} className="max-w-full max-h-[400px] rounded-lg" />
                                                        ) : post.mediaType === 'image' || (typeof post.media === 'string' && post.media.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                                                            <SafeImage 
                                                                src={post.media} 
                                                                alt="Media" 
                                                                onClick={() => setFullScreenImage(post.media)}
                                                                className="max-w-full max-h-[400px] w-auto h-auto object-contain cursor-pointer hover:opacity-90 transition-all rounded-lg" 
                                                            />
                                                        ) : (
                                                            <a href={post.media} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 transition-colors rounded-lg">
                                                                <Paperclip className="w-4 h-4" />
                                                                <span className="text-sm">View File</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </SensitiveMediaWrapper>
                                            )}
                                        </div>
                                    )}
                                    
                                    {editingPostId === post.postId ? (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={editingContent}
                                                onChange={(e) => setEditingContent(e.target.value)}
                                                className="flex-1 px-2 py-1 rounded bg-white/20 text-white placeholder-white/50 focus:outline-none"
                                                placeholder="Edit message..."
                                            />
                                            <button
                                                onClick={() => handleEditPost(post.postId)}
                                                className="px-2 py-1 bg-white/30 hover:bg-white/40 rounded text-sm"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between gap-2 w-full">
                                                {post.type === "poll" ? (
                                                    <div className="space-y-2 flex-1">
                                                        <p className="font-medium mb-2">{post.content}</p>
                                                        {post.pollOptions?.map((option, idx) => (
                                                            <button
                                                                key={idx}
                                                                className="w-full text-left px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors text-sm"
                                                            >
                                                                {option}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="break-words text-sm leading-relaxed flex-1 overflow-hidden">{post.content}</p>
                                                )}
                                                {/* Post Menu Button - Inside bubble with dropdown */}
                                                {isOwn && (
                                                    <div className="relative flex-shrink-0">
                                                        <button
                                                            onClick={() => setShowPostMenu(showPostMenu === post.postId ? null : post.postId)}
                                                            className="p-1 rounded-full hover:bg-black/20 transition-all"
                                                        >
                                                            <MoreVertical className="w-4 h-4 text-black/60 dark:text-white/80" />
                                                        </button>
                                                        {/* Dropdown Menu - Right next to button */}
                                                        <AnimatePresence>
                                                            {showPostMenu === post.postId && (
                                                                <>
                                                                    <div 
                                                                        className="fixed inset-0 z-[100]" 
                                                                        onClick={() => setShowPostMenu(null)}
                                                                    />
                                                                    <motion.div
                                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                                        animate={{ opacity: 1, scale: 1 }}
                                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                                        className="absolute top-0 right-full mr-1 bg-white dark:bg-[#202c33] rounded-lg shadow-xl border dark:border-[#2a3942] border-gray-200 overflow-hidden z-[101] min-w-[100px]"
                                                                    >
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingPostId(post.postId);
                                                                                setEditingContent(post.content);
                                                                                setShowPostMenu(null);
                                                                            }}
                                                                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-[#2a3942] text-gray-900 dark:text-white transition-colors text-sm"
                                                                        >
                                                                            <Edit2 className="w-3.5 h-3.5" />
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                handleDeletePost(post.postId);
                                                                                setShowPostMenu(null);
                                                                            }}
                                                                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors text-sm"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                            Delete
                                                                        </button>
                                                                    </motion.div>
                                                                </>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                                <span className="text-[10px] whitespace-nowrap text-black/60 dark:text-white/70">
                                                    {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </>
                                    )}

                                </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 dark:text-gray-700 text-gray-300 mx-auto mb-4" />
                        <p className="dark:text-gray-400 text-gray-600">
                            {isMember ? "No messages yet. Start the conversation!" : "No messages in this channel yet."}
                        </p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Join Button for non-members */}
            {!isMember && (
                <div className="dark:bg-[#202c33] bg-white px-4 py-3 border-t dark:border-[#2a3942] border-gray-200 flex-shrink-0 mb-[72px] md:mb-0">
                    <button
                        onClick={async () => {
                            try {
                                const token = localStorage.getItem("token");
                                await axios.post(`/api/groups/${id}/join`, {}, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                toast.success("Joined the channel!");
                                fetchGroup();
                            } catch (error) {
                                console.error("Error joining group:", error);
                                toast.error("Failed to join channel");
                            }
                        }}
                        className="w-full py-3 bg-[#00a884] hover:bg-[#06cf9c] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Users className="w-5 h-5" />
                        Join Channel
                    </button>
                </div>
            )}

            {/* Notice for members who can't post (when allowMembersToChat is OFF) */}
            {isMember && !canPost && (
                <div className="dark:bg-[#202c33] bg-white px-4 py-3 border-t dark:border-[#2a3942] border-gray-200 flex-shrink-0 mb-[72px] md:mb-0">
                    <div className="flex items-center justify-center gap-2 text-[#8696a0] text-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V7a4 4 0 00-8 0v4m-2 0h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                        </svg>
                        <span>Only admins can send messages</span>
                    </div>
                </div>
            )}

            {/* Input Area (only for owner/admins) - Pinned at bottom above navigation */}
            {canPost && (
                <div className="dark:bg-[#202c33] bg-white px-3 py-2 border-t dark:border-[#2a3942] border-gray-200 flex-shrink-0 mb-[72px] md:mb-0">
                    {/* Telegram-style Media Previews with Numbers */}
                    {mediaPreviews.length > 0 && (
                        <div className="mb-3">
                            {/* Header with count and three dots menu */}
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {mediaPreviews.length} {mediaPreviews.length === 1 ? 'photo' : 'photos'} selected
                                </span>
                                
                                {/* Right side - Three dots menu and Close button */}
                                <div className="relative flex items-center gap-2">
                                    {/* Three dots button */}
                                    <button
                                        type="button"
                                        onClick={() => setShowMediaOptionsMenu(!showMediaOptionsMenu)}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2a3942] rounded-full transition-colors"
                                    >
                                        <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                    </button>
                                    
                                    {/* Telegram-style Dropdown Menu */}
                                    <AnimatePresence>
                                        {showMediaOptionsMenu && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-40"
                                                    onClick={() => setShowMediaOptionsMenu(false)}
                                                />
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute top-full right-0 mt-1 bg-white dark:bg-[#202c33] rounded-xl shadow-2xl border dark:border-[#2a3942] border-gray-200 overflow-hidden z-50 min-w-[220px]"
                                                >
                                                    {/* Show Preview Option */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowMediaOptionsMenu(false);
                                                            setCurrentPreviewIndex(0);
                                                            setShowMediaPreviewModal(true);
                                                        }}
                                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                    >
                                                        <Eye className="w-5 h-5 text-[#3390ec]" />
                                                        <span className="text-gray-900 dark:text-white font-medium">Show preview</span>
                                                    </button>
                                                    
                                                    {/* Send Without Grouping Option */}
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            setShowMediaOptionsMenu(false);
                                                            if (selectedMedia.length === 0) return;
                                                            setIsSending(true);
                                                            
                                                            // Send each file individually
                                                            for (let i = 0; i < selectedMedia.length; i++) {
                                                                const file = selectedMedia[i];
                                                                try {
                                                                    const token = localStorage.getItem("token");
                                                                    const formData = new FormData();
                                                                    formData.append("content", "");
                                                                    formData.append("media", file);
                                                                    
                                                                    await axios.post(`/api/groups/${id}/posts`, formData, {
                                                                        headers: { 
                                                                            Authorization: `Bearer ${token}`,
                                                                            "Content-Type": "multipart/form-data"
                                                                        }
                                                                    });
                                                                } catch (error) {
                                                                    console.error(`Error sending file ${i + 1}:`, error);
                                                                }
                                                            }
                                                            
                                                            toast.success(`${selectedMedia.length} files sent individually!`);
                                                            setSelectedMedia([]);
                                                            setMediaPreviews([]);
                                                            setNewPost("");
                                                            fetchGroup();
                                                            setIsSending(false);
                                                        }}
                                                        disabled={isSending}
                                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                    >
                                                        <Grid3X3 className="w-5 h-5 text-[#3390ec]" />
                                                        <span className="text-gray-900 dark:text-white font-medium">Send without grouping</span>
                                                    </button>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                    
                                    {/* Close button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedMedia([]);
                                            setMediaPreviews([]);
                                        }}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2a3942] rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Photos Grid with Numbers */}
                            <div className="flex flex-wrap gap-2">
                                {mediaPreviews.map((preview, index) => (
                                    <div key={index} className="relative group">
                                        {preview.type === 'image' ? (
                                            <img 
                                                src={preview.url} 
                                                alt={`Preview ${index + 1}`} 
                                                className="h-16 w-16 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => {
                                                    setCurrentPreviewIndex(index);
                                                    setShowMediaPreviewModal(true);
                                                }}
                                            />
                                        ) : preview.type === 'video' ? (
                                            <video src={preview.url} className="h-16 w-16 object-cover rounded-lg" />
                                        ) : (
                                            <div className="px-3 py-2 dark:bg-[#2a3942] bg-gray-200 rounded-lg flex items-center gap-2 h-16 w-16">
                                                <Paperclip className="w-4 h-4" />
                                            </div>
                                        )}
                                        {/* Number Badge - Telegram Style */}
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#3390ec] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                            {index + 1}
                                        </div>
                                        {/* Remove button on hover */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newMedia = selectedMedia.filter((_, i) => i !== index);
                                                const newPreviews = mediaPreviews.filter((_, i) => i !== index);
                                                setSelectedMedia(newMedia);
                                                setMediaPreviews(newPreviews);
                                            }}
                                            className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {/* Add more button */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-16 w-16 rounded-lg border-2 border-dashed dark:border-gray-600 border-gray-300 flex items-center justify-center dark:text-gray-400 text-gray-500 hover:dark:border-gray-500 hover:border-gray-400 transition-colors"
                                >
                                    <span className="text-2xl">+</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handlePostSubmit} className="flex items-center gap-2">
                        {/* Attach Menu */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowAttachMenu(!showAttachMenu)}
                                className="dark:text-[#8696a0] text-gray-600 dark:hover:text-white hover:text-gray-900 p-2"
                            >
                                <Paperclip className="w-6 h-6" />
                            </button>

                            {showAttachMenu && (
                                <div className="absolute bottom-full left-0 mb-2 dark:bg-[#2a3942] bg-white rounded-lg shadow-lg p-2 space-y-1 min-w-[200px]">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            fileInputRef.current?.click();
                                            setShowAttachMenu(false);
                                        }}
                                        className="flex items-center gap-3 px-4 py-2 dark:hover:bg-white/5 hover:bg-gray-100 rounded-lg w-full text-left"
                                    >
                                        <ImageIcon className="w-5 h-5 text-blue-500" />
                                        <div>
                                            <p className="dark:text-white text-gray-900 font-medium">Media</p>
                                            <p className="text-xs dark:text-gray-400 text-gray-600">Photos, Videos, Audio</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPollModal(true);
                                            setShowAttachMenu(false);
                                        }}
                                        className="flex items-center gap-3 px-4 py-2 dark:hover:bg-white/5 hover:bg-gray-100 rounded-lg w-full text-left"
                                    >
                                        <BarChart3 className="w-5 h-5 text-green-500" />
                                        <div>
                                            <p className="dark:text-white text-gray-900 font-medium">Poll</p>
                                            <p className="text-xs dark:text-gray-400 text-gray-600">Create a poll</p>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                            onChange={handleMediaSelect}
                            multiple
                            className="hidden"
                        />

                        <input
                            type="text"
                            placeholder="Type a message"
                            className="flex-1 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 dark:placeholder-[#8696a0] placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                            value={newPost}
                            onChange={(e) => setNewPost(e.target.value)}
                        />

                        {(newPost.trim() || selectedMedia.length > 0) ? (
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                type="submit"
                                disabled={isSending}
                                className={`${isSending ? 'bg-[#00a884]/50 cursor-not-allowed' : 'bg-[#00a884] hover:bg-[#06cf9c]'} text-black p-2.5 rounded-full transition-colors`}
                            >
                                {isSending ? (
                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </motion.button>
                        ) : (
                            <button type="button" className="dark:text-[#8696a0] text-gray-600 p-2">
                                <Smile className="w-6 h-6" />
                            </button>
                        )}
                    </form>
                </div>
            )}

            {/* Poll Creation Modal */}
            <AnimatePresence>
                {showPollModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowPollModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-panel max-w-md w-full p-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold dark:text-white text-gray-900">Create Poll</h2>
                                <button
                                    onClick={() => setShowPollModal(false)}
                                    className="dark:text-gray-400 text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-2">
                                        Question
                                    </label>
                                    <input
                                        type="text"
                                        className="input-field w-full"
                                        value={pollQuestion}
                                        onChange={(e) => setPollQuestion(e.target.value)}
                                        placeholder="Ask a question..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-2">
                                        Options
                                    </label>
                                    <div className="space-y-2">
                                        {pollOptions.map((option, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="input-field flex-1"
                                                    value={option}
                                                    onChange={(e) => {
                                                        const newOptions = [...pollOptions];
                                                        newOptions[index] = e.target.value;
                                                        setPollOptions(newOptions);
                                                    }}
                                                    placeholder={`Option ${index + 1}`}
                                                />
                                                {pollOptions.length > 2 && (
                                                    <button
                                                        onClick={() => removePollOption(index)}
                                                        className="text-red-500 hover:text-red-600"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={addPollOption}
                                        className="mt-2 text-primary hover:text-primary/80 text-sm flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Option
                                    </button>
                                </div>

                                <button
                                    onClick={handleCreatePoll}
                                    className="btn-primary w-full"
                                >
                                    Create Poll
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Channel Info Panel - Telegram Style */}
            <ChannelInfo
                isOpen={showChannelInfo}
                onClose={() => setShowChannelInfo(false)}
                group={group}
                user={user}
                onSaveGroup={async (data) => {
                    try {
                        const token = localStorage.getItem("token");
                        const formData = new FormData();
                        formData.append("name", data.name);
                        formData.append("description", data.description || "");
                        formData.append("privacy", data.privacy || "public");
                        // Convert boolean to string explicitly for FormData
                        formData.append("allowMembersToChat", String(data.allowMembersToChat));
                        if (data.photo) {
                            formData.append("coverImage", data.photo);
                        }
                        
                        console.log("💾 Sending allowMembersToChat:", data.allowMembersToChat, "as string:", String(data.allowMembersToChat));
                        
                        await axios.put(`/api/groups/${id}`, formData, {
                            headers: { 
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "multipart/form-data"
                            }
                        });
                        
                        toast.success("Channel updated successfully!");
                        fetchGroup();
                    } catch (error) {
                        console.error("Error updating group:", error);
                        toast.error("Failed to update channel");
                        throw error;
                    }
                }}
                onDeleteGroup={() => {
                    setShowChannelInfo(false);
                    handleDeleteGroup();
                }}
                onLeaveGroup={async () => {
                    setShowChannelInfo(false);
                    try {
                        const token = localStorage.getItem("token");
                        await axios.post(`/api/groups/${id}/leave`, {}, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        toast.success("Left the channel");
                        navigate("/groups");
                    } catch (error) {
                        console.error("Error leaving group:", error);
                        toast.error("Failed to leave channel");
                    }
                }}
                onNavigateToSettings={() => {
                    toast.info("Channel settings coming soon!");
                }}
                onGroupUpdated={(updatedGroup) => {
                    setGroup(updatedGroup);
                    toast.success("Invite link regenerated!");
                }}
            />

            {/* Delete Group Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteGroupConfirm}
                onClose={() => setShowDeleteGroupConfirm(false)}
                onConfirm={executeDeleteGroup}
                title="Delete Group"
                message="Are you sure you want to delete this group? This action cannot be undone and all messages will be lost."
                confirmText="Delete"
                confirmStyle="danger"
            />

            {/* Full Screen Image Viewer */}
            <AnimatePresence>
                {fullScreenImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center"
                        onClick={() => setFullScreenImage(null)}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setFullScreenImage(null)}
                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>
                        
                        {/* Full Size Image */}
                        <motion.img
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            src={fullScreenImage}
                            alt="Full size"
                            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Telegram-style Media Preview Modal - Shows how it will look after sending */}
            <AnimatePresence>
                {showMediaPreviewModal && mediaPreviews.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/95 z-[300] flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-black/50">
                            <button
                                onClick={() => setShowMediaPreviewModal(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6 text-white" />
                            </button>
                            <div className="text-white text-center">
                                <span className="font-medium">Preview</span>
                                <span className="text-white/60"> - {mediaPreviews.length} {mediaPreviews.length === 1 ? 'photo' : 'photos'}</span>
                            </div>
                            <button
                                onClick={() => setShowMediaPreviewModal(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-white" />
                            </button>
                        </div>
                        
                        {/* Main Preview Area - Shows exactly like channel upload (big photo + small row) */}
                        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                            <div className="max-w-sm w-full">
                                {/* Message bubble preview - Telegram style grouped layout */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-gradient-to-br from-primary/80 to-secondary/80 rounded-2xl rounded-br-none p-1.5 shadow-lg"
                                >
                                    {mediaPreviews.length === 1 ? (
                                        /* Single image - full size */
                                        <div className="rounded-xl overflow-hidden">
                                            {mediaPreviews[0].type === 'video' ? (
                                                <video src={mediaPreviews[0].url} className="w-full max-h-[300px] object-contain" />
                                            ) : (
                                                <img src={mediaPreviews[0].url} alt="Preview" className="w-full max-h-[300px] object-contain" />
                                            )}
                                        </div>
                                    ) : mediaPreviews.length === 2 ? (
                                        /* 2 images - side by side */
                                        <div className="grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden">
                                            {mediaPreviews.map((preview, idx) => (
                                                <div key={idx} className="aspect-square">
                                                    {preview.type === 'video' ? (
                                                        <video src={preview.url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={preview.url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        /* 3+ images - Big one on top, small ones in row below */
                                        <div className="rounded-xl overflow-hidden">
                                            {/* Main large image */}
                                            <div className="w-full aspect-[4/3] mb-0.5">
                                                {mediaPreviews[0].type === 'video' ? (
                                                    <video src={mediaPreviews[0].url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <img src={mediaPreviews[0].url} alt="Preview 1" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            {/* Small images row */}
                                            <div className={`grid gap-0.5 ${
                                                mediaPreviews.length === 3 ? 'grid-cols-2' :
                                                mediaPreviews.length === 4 ? 'grid-cols-3' :
                                                mediaPreviews.length >= 5 ? 'grid-cols-4' : 'grid-cols-3'
                                            }`}>
                                                {mediaPreviews.slice(1, 5).map((preview, idx) => {
                                                    const isLast = idx === 3 && mediaPreviews.length > 5;
                                                    return (
                                                        <div key={idx + 1} className="aspect-square relative">
                                                            {preview.type === 'video' ? (
                                                                <video src={preview.url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <img src={preview.url} alt={`Preview ${idx + 2}`} className="w-full h-full object-cover" />
                                                            )}
                                                            {isLast && (
                                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg">
                                                                    +{mediaPreviews.length - 5}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Time stamp */}
                                    <div className="flex items-center justify-end gap-1.5 mt-1 px-1">
                                        <span className="text-[10px] text-white/70">
                                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </motion.div>
                                
                                {/* Label */}
                                <p className="text-white/60 text-center text-sm mt-4">
                                    This is how your {mediaPreviews.length} {mediaPreviews.length === 1 ? 'photo' : 'photos'} will appear
                                </p>
                            </div>
                        </div>
                        
                        {/* Thumbnail Strip */}
                        <div className="px-4 py-3 bg-black/50">
                            <div className="flex gap-2 justify-center overflow-x-auto pb-2">
                                {mediaPreviews.map((preview, idx) => (
                                    <div
                                        key={idx}
                                        className="relative flex-shrink-0 rounded-lg overflow-hidden"
                                    >
                                        {preview.type === 'image' ? (
                                            <img
                                                src={preview.url}
                                                alt={`Thumb ${idx + 1}`}
                                                className="w-14 h-14 object-cover"
                                            />
                                        ) : (
                                            <video
                                                src={preview.url}
                                                className="w-14 h-14 object-cover"
                                            />
                                        )}
                                        {/* Number Badge */}
                                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#3390ec] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                            {idx + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Bottom Actions */}
                        <div className="px-4 py-4 bg-black/80 flex gap-3">
                            <button
                                onClick={async () => {
                                    setShowMediaPreviewModal(false);
                                    // Submit the form (send as group)
                                    if (selectedMedia.length === 0) return;
                                    setIsSending(true);
                                    try {
                                        const token = localStorage.getItem("token");
                                        const formData = new FormData();
                                        formData.append("content", newPost);
                                        selectedMedia.forEach((file) => {
                                            formData.append("media", file);
                                        });
                                        await axios.post(`/api/groups/${id}/posts`, formData, {
                                            headers: { 
                                                Authorization: `Bearer ${token}`,
                                                "Content-Type": "multipart/form-data"
                                            }
                                        });
                                        setNewPost("");
                                        setSelectedMedia([]);
                                        setMediaPreviews([]);
                                        fetchGroup();
                                        toast.success("Media sent!");
                                    } catch (error) {
                                        console.error("Error sending:", error);
                                        toast.error("Failed to send");
                                    } finally {
                                        setIsSending(false);
                                    }
                                }}
                                disabled={isSending}
                                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                                    isSending 
                                        ? 'bg-[#3390ec]/50 cursor-not-allowed' 
                                        : 'bg-[#3390ec] hover:bg-[#2b7fd4]'
                                } text-white transition-colors`}
                            >
                                <Layers className="w-5 h-5" />
                                {isSending ? 'Sending...' : `Send as Group (${mediaPreviews.length})`}
                            </button>
                            <button
                                onClick={async () => {
                                    setShowMediaPreviewModal(false);
                                    if (selectedMedia.length === 0) return;
                                    setIsSending(true);
                                    
                                    for (let i = 0; i < selectedMedia.length; i++) {
                                        const file = selectedMedia[i];
                                        try {
                                            const token = localStorage.getItem("token");
                                            const formData = new FormData();
                                            formData.append("content", "");
                                            formData.append("media", file);
                                            
                                            await axios.post(`/api/groups/${id}/posts`, formData, {
                                                headers: { 
                                                    Authorization: `Bearer ${token}`,
                                                    "Content-Type": "multipart/form-data"
                                                }
                                            });
                                        } catch (error) {
                                            console.error(`Error sending file ${i + 1}:`, error);
                                        }
                                    }
                                    
                                    toast.success(`${selectedMedia.length} files sent individually!`);
                                    setSelectedMedia([]);
                                    setMediaPreviews([]);
                                    setNewPost("");
                                    fetchGroup();
                                    setIsSending(false);
                                }}
                                disabled={isSending}
                                className="flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <Grid3X3 className="w-5 h-5" />
                                Send Without Grouping
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GroupDetail;
