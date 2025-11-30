import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useToast } from "../context/ToastContext";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Search, ArrowLeft, MoreVertical, Phone, Video, Paperclip, Smile, Mic, Eye, EyeOff, Edit2, Trash2, X, Image, FileText, Camera, Music, MapPin, ChevronLeft, ChevronRight, Layers, Grid3X3 } from "lucide-react";
import { SafeAvatar } from "../components/SafeImage";
import CallModal from "../components/CallModal";
import ConfirmModal from "../components/ConfirmModal";
import { AvatarWithStatus, OnlineBadge } from "../components/OnlineIndicator";
import HamsterLoader from "../components/HamsterLoader";

const Chat = () => {
    const { user } = useAuth();
    const { socket } = useNotifications();
    const location = useLocation();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [showConversations, setShowConversations] = useState(true);
    const [isCallModalOpen, setIsCallModalOpen] = useState(false);
    const [callType, setCallType] = useState(null);
    const [isIncomingCall, setIsIncomingCall] = useState(false);
    const [incomingCallData, setIncomingCallData] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingContent, setEditingContent] = useState("");
    const [showMessageMenu, setShowMessageMenu] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState(null);
    const [selectedMedia, setSelectedMedia] = useState([]);
    const [mediaPreview, setMediaPreview] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [showMediaPreviewModal, setShowMediaPreviewModal] = useState(false);
    const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
    const [showMediaOptionsMenu, setShowMediaOptionsMenu] = useState(false);
    const fileInputRef = useRef(null);
    const documentInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const toast = useToast();

    useEffect(() => {
        fetchConversations();
        
        // Sync unread count with Redis when Chat page loads
        const syncUnreadCount = async () => {
            try {
                const token = localStorage.getItem("token");
                await axios.post('/api/messages/sync-unread-count', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log('🔄 Synced unread count with Redis');
            } catch (error) {
                console.error('Error syncing unread count:', error);
            }
        };
        syncUnreadCount();
        
        // Check if user was passed from profile or incoming call
        if (location.state?.selectedUser) {
            handleSelectUser({ user: location.state.selectedUser });
            setShowConversations(false);
            
            // Handle incoming call from global overlay
            if (location.state?.incomingCall) {
                const { from, offer, callType: incomingCallType } = location.state.incomingCall;
                setIncomingCallData({ from, offer });
                setCallType(incomingCallType);
                setIsIncomingCall(true);
                setIsCallModalOpen(true);
            }
        }
    }, []);

    useEffect(() => {
        if (socket) {
            // Listen for new messages in real-time
            socket.on("message", (message) => {
                console.log("💬 New message received:", message);
                
                // Add message to current conversation if it's relevant
                if (selectedUser && (message.senderId === selectedUser.userId || message.receiverId === selectedUser.userId)) {
                    setMessages(prev => {
                        // Avoid duplicates
                        const exists = prev.some(m => m.messageId === message.messageId);
                        if (exists) return prev;
                        return [...prev, message];
                    });
                    
                    // Mark as read if chat is open
                    if (message.senderId === selectedUser.userId) {
                        const token = localStorage.getItem("token");
                        axios.post(`/api/messages/mark-read/${selectedUser.userId}`, {}, {
                            headers: { Authorization: `Bearer ${token}` }
                        }).catch(err => console.error("Error marking as read:", err));
                    }
                }
                
                // Update conversations list
                fetchConversations();
            });

            // Listen for message read status updates
            socket.on("messagesRead", (data) => {
                // Update messages with read status
                setMessages(prev => 
                    prev.map(msg => 
                        msg.senderId === user.userId && msg.receiverId === data.userId 
                            ? { ...msg, read: true } 
                            : msg
                    )
                );
                fetchConversations();
            });

            // Listen for typing indicator
            socket.on("userTyping", (data) => {
                console.log(`${data.username} is typing...`);
            });

            // Listen for typing stopped
            socket.on("userStoppedTyping", (data) => {
                console.log(`${data.username} stopped typing`);
            });

            // Listen for message edits
            socket.on("messageEdited", ({ messageId, content }) => {
                setMessages(prev => 
                    prev.map(msg => 
                        msg.messageId === messageId 
                            ? { ...msg, content, edited: true } 
                            : msg
                    )
                );
            });

            // Listen for message deletions
            socket.on("messageDeleted", ({ messageId }) => {
                setMessages(prev => prev.filter(msg => msg.messageId !== messageId));
            });

            // Listen for incoming calls
            socket.on("call:incoming", ({ from, offer, callType: incomingCallType }) => {
                console.log("📞 Incoming call from:", from);
                setIncomingCallData({ from, offer });
                setCallType(incomingCallType);
                setIsIncomingCall(true);
                setIsCallModalOpen(true);
                // Set the caller as selected user for the call
                setSelectedUser(from);
            });

            return () => {
                socket.off("message");
                socket.off("messagesRead");
                socket.off("userTyping");
                socket.off("userStoppedTyping");
                socket.off("messageEdited");
                socket.off("messageDeleted");
                socket.off("call:incoming");
            };
        }
    }, [socket, selectedUser, user.userId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchConversations = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("/api/messages/conversations", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConversations(res.data);
        } catch (error) {
            console.error("Error fetching conversations:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (userId) => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`/api/messages/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(res.data);
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    };

    const handleSelectUser = async (conversation) => {
        setSelectedUser(conversation.user);
        await fetchMessages(conversation.user.userId);
        setShowConversations(false); // Hide conversations on mobile
        
        // Mark messages as read
        try {
            const token = localStorage.getItem("token");
            await axios.post(`/api/messages/mark-read/${conversation.user.userId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Update local messages to mark them as read
            setMessages(prev => 
                prev.map(msg => 
                    msg.senderId === conversation.user.userId 
                        ? { ...msg, read: true } 
                        : msg
                )
            );
            
            // Emit read status via Socket.IO
            if (socket) {
                socket.emit("markMessagesRead", {
                    userId: conversation.user.userId
                });
            }
            
            // Refresh conversations to update unread count
            fetchConversations();
            
            // Note: Unread count is automatically updated via Redis PUB/SUB
        } catch (error) {
            console.error("Error marking messages as read:", error);
        }
    };

    const handleBack = () => {
        setShowConversations(true);
        setSelectedUser(null);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser) return;

        const messageContent = newMessage;
        const tempMessage = {
            messageId: `temp-${Date.now()}`,
            senderId: user.userId,
            receiverId: selectedUser.userId,
            content: messageContent,
            createdAt: new Date().toISOString(),
            read: false,
            sending: true // Flag to show sending status
        };

        // Optimistic update - add message immediately
        setMessages(prev => [...prev, tempMessage]);
        setNewMessage(""); // Clear input immediately for better UX
        setIsSending(true); // Disable send button

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post("/api/messages", {
                receiverId: selectedUser.userId,
                content: messageContent
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Replace temp message with real one
            setMessages(prev => prev.map(msg => 
                msg.messageId === tempMessage.messageId ? res.data : msg
            ));
            
            // Emit message via Socket.IO for real-time delivery
            if (socket) {
                socket.emit("sendMessage", {
                    messageId: res.data.messageId,
                    senderId: user.userId,
                    receiverId: selectedUser.userId,
                    content: messageContent,
                    createdAt: res.data.createdAt,
                    read: false
                });
            }
            
            fetchConversations();
        } catch (error) {
            console.error("Error sending message:", error);
            setNewMessage(messageContent); // Restore message on error
            // Remove temp message on error
            setMessages(prev => prev.filter(msg => msg.messageId !== tempMessage.messageId));
        } finally {
            setIsSending(false); // Re-enable send button
        }
    };

    const filteredConversations = conversations.filter(conv =>
        conv.user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startVoiceCall = () => {
        setCallType("voice");
        setIsCallModalOpen(true);
    };

    const startVideoCall = () => {
        setCallType("video");
        setIsCallModalOpen(true);
    };

    const handleEditMessage = async (messageId) => {
        if (!editingContent.trim()) return;
        try {
            const token = localStorage.getItem("token");
            await axios.put(`/api/messages/${messageId}`, 
                { content: editingContent },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessages(prev => 
                prev.map(msg => 
                    msg.messageId === messageId 
                        ? { ...msg, content: editingContent, edited: true } 
                        : msg
                )
            );
            setEditingMessageId(null);
            setEditingContent("");
            setShowMessageMenu(null);
            toast.success("Message edited");
        } catch (error) {
            console.error("Error editing message:", error);
            toast.error("Failed to edit message");
        }
    };

    const handleDeleteMessage = (messageId) => {
        setMessageToDelete(messageId);
        setShowDeleteConfirm(true);
        setShowMessageMenu(null);
    };

    const executeDeleteMessage = async () => {
        if (!messageToDelete) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`/api/messages/${messageToDelete}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(prev => prev.filter(msg => msg.messageId !== messageToDelete));
            toast.success("Message deleted");
        } catch (error) {
            console.error("Error deleting message:", error);
            toast.error("Failed to delete message");
        } finally {
            setMessageToDelete(null);
            setShowDeleteConfirm(false);
        }
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
        const newValidFiles = [];
        const newPreviews = [];

        for (const file of files) {
            // Validate file size (max 10MB each)
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`${file.name} is too large (max 10MB)`);
                continue;
            }

            // Validate file type
            if (!validTypes.includes(file.type)) {
                toast.error(`${file.name} is not a valid file type`);
                continue;
            }

            // Check for duplicates by name
            const isDuplicate = selectedMedia.some(existing => existing.name === file.name && existing.size === file.size);
            if (isDuplicate) {
                toast.warning(`${file.name} is already selected`);
                continue;
            }

            newValidFiles.push(file);
            newPreviews.push({
                url: URL.createObjectURL(file),
                type: file.type.startsWith('video/') ? 'video' : 'image',
                name: file.name
            });
        }

        if (newValidFiles.length > 0) {
            // Append to existing files instead of replacing
            setSelectedMedia(prev => [...prev, ...newValidFiles]);
            setMediaPreview(prev => [...prev, ...newPreviews]);
            toast.success(`${newValidFiles.length} file(s) added`);
            // Auto-open attachment modal to show full UI
            setShowAttachmentMenu(true);
        }
    };

    const clearMediaPreview = () => {
        // Revoke object URLs to prevent memory leaks
        mediaPreview.forEach(preview => URL.revokeObjectURL(preview.url));
        setSelectedMedia([]);
        setMediaPreview([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const uploadMedia = async (file) => {
        try {
            const token = localStorage.getItem("token");
            
            // Use server-side upload (more reliable than presigned URLs)
            const formData = new FormData();
            formData.append('media', file);
            
            const res = await axios.post('/api/upload/server', formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            return res.data.url;
        } catch (error) {
            console.error("Error uploading media:", error);
            throw error;
        }
    };

    const handleSendMediaMessage = async () => {
        if (selectedMedia.length === 0 || !selectedUser) return;

        setIsUploading(true);
        const tempId = `temp-${Date.now()}`;
        
        // Create preview URLs array for optimistic update
        const previewUrls = mediaPreview.map(p => p.url);
        const mediaTypes = mediaPreview.map(p => p.type);
        
        // Optimistic update with all previews
        const tempMessage = {
            messageId: tempId,
            senderId: user.userId,
            receiverId: selectedUser.userId,
            content: '',
            mediaUrl: selectedMedia.length === 1 ? previewUrls[0] : previewUrls,
            mediaType: selectedMedia.length === 1 ? mediaTypes[0] : mediaTypes,
            createdAt: new Date().toISOString(),
            read: false,
            sending: true
        };
        setMessages(prev => [...prev, tempMessage]);
        
        try {
            const token = localStorage.getItem("token");
            
            // Upload all media files
            const uploadedUrls = [];
            for (const file of selectedMedia) {
                const url = await uploadMedia(file);
                uploadedUrls.push(url);
            }
            
            // Send message with all media URLs
            const res = await axios.post("/api/messages", {
                receiverId: selectedUser.userId,
                content: '',
                mediaUrl: selectedMedia.length === 1 ? uploadedUrls[0] : uploadedUrls,
                mediaType: selectedMedia.length === 1 ? mediaTypes[0] : mediaTypes
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Replace temp message with real one
            setMessages(prev => prev.map(msg => 
                msg.messageId === tempId ? res.data : msg
            ));

            // Emit via socket
            if (socket) {
                socket.emit("sendMessage", {
                    ...res.data
                });
            }

            toast.success(`${selectedMedia.length} media file(s) sent!`);
            clearMediaPreview();
            fetchConversations();
        } catch (error) {
            console.error("Error sending media:", error);
            toast.error("Failed to send media");
            // Remove temp message on error
            setMessages(prev => prev.filter(msg => msg.messageId !== tempId));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 md:pl-72 pb-[72px] md:pb-0 dark:bg-[#111b21] bg-gray-50">
                <div className="h-full flex overflow-hidden">
                {/* Conversations List - WhatsApp Style */}
                <div className={`${showConversations ? 'flex' : 'hidden md:flex'} w-full md:w-80 lg:w-96 dark:bg-[#111b21] bg-white border-r dark:border-[#2a3942] border-gray-200 flex-col`}>
                        {/* WhatsApp Header */}
                        <div className="dark:bg-[#202c33] bg-gray-100 p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold dark:text-white text-gray-900">Chats</h2>
                                <div className="flex gap-4">
                                    <MoreVertical className="w-5 h-5 dark:text-[#aebac1] text-gray-600 cursor-pointer dark:hover:text-white hover:text-gray-900" />
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-[#8696a0] text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search or start new chat"
                                    className="w-full dark:bg-[#202c33] bg-white dark:border-[#2a3942] border-gray-300 rounded-lg pl-12 pr-4 py-2 text-sm dark:text-white text-gray-900 dark:placeholder-[#8696a0] placeholder-gray-500 focus:outline-none focus:border-[#00a884]"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        {/* Conversations List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                // Hamster Loading Animation
                                <div className="flex justify-center items-center py-12">
                                    <HamsterLoader size="medium" text="Loading chats..." />
                                </div>
                            ) : filteredConversations.length === 0 ? (
                                <div className="p-8 text-center dark:text-[#8696a0] text-gray-600">
                                    <p className="text-sm">No conversations yet</p>
                                    <p className="text-xs mt-2">Start chatting with your friends!</p>
                                </div>
                            ) : (
                                filteredConversations.map((conv) => (
                                    <motion.button
                                        key={conv.partnerId}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSelectUser(conv)}
                                        className={`w-full p-3 flex items-center gap-3 dark:hover:bg-[#202c33] hover:bg-gray-100 transition-colors border-b dark:border-[#2a3942] border-gray-200 ${
                                            selectedUser?.userId === conv.user.userId ? 'dark:bg-[#2a3942] bg-gray-200' : ''
                                        }`}
                                    >
                                        <AvatarWithStatus 
                                            userId={conv.user.userId}
                                            indicatorSize="sm"
                                        >
                                            <SafeAvatar
                                                src={conv.user.avatar}
                                                alt={conv.user.username}
                                                fallbackText={conv.user.username}
                                                className="w-12 h-12 rounded-full"
                                                onError={(e) => {
                                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.user.username)}&background=random`;
                                                }}
                                            />
                                        </AvatarWithStatus>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h3 className="font-medium dark:text-white text-gray-900 truncate">{conv.user.username}</h3>
                                                <span className="text-xs dark:text-[#8696a0] text-gray-600 ml-2 flex-shrink-0">
                                                    {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm dark:text-[#8696a0] text-gray-600 truncate flex-1">
                                                    {conv.lastMessage.content}
                                                </p>
                                                {conv.unreadCount > 0 && (
                                                    <span className="bg-[#00a884] text-black text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ml-2 flex-shrink-0">
                                                        {conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Area - WhatsApp Style */}
                    <div className={`${!showConversations ? 'flex' : 'hidden md:flex'} flex-1 flex-col dark:bg-[#0b141a] bg-gray-50`}>
                        {selectedUser ? (
                            <>
                                {/* WhatsApp Chat Header */}
                                <div className="dark:bg-[#202c33] bg-white px-4 py-3 flex items-center gap-3 border-b dark:border-[#2a3942] border-gray-200">
                                    <button 
                                        onClick={handleBack}
                                        className="md:hidden dark:text-[#aebac1] text-gray-600 dark:hover:text-white hover:text-gray-900"
                                    >
                                        <ArrowLeft className="w-6 h-6" />
                                    </button>
                                    <AvatarWithStatus 
                                        userId={selectedUser.userId}
                                        indicatorSize="sm"
                                    >
                                        <SafeAvatar
                                            src={selectedUser.avatar}
                                            alt={selectedUser.username}
                                            fallbackText={selectedUser.username}
                                            className="w-10 h-10 rounded-full"
                                        />
                                    </AvatarWithStatus>
                                    <div className="flex-1">
                                        <h3 className="font-medium dark:text-white text-gray-900">{selectedUser.username}</h3>
                                        <OnlineBadge userId={selectedUser.userId} />
                                    </div>
                                    <div className="flex gap-4">
                                        <Video 
                                            onClick={startVideoCall}
                                            className="w-5 h-5 dark:text-[#aebac1] text-gray-600 cursor-pointer dark:hover:text-white hover:text-gray-900" 
                                        />
                                        <Phone 
                                            onClick={startVoiceCall}
                                            className="w-5 h-5 dark:text-[#aebac1] text-gray-600 cursor-pointer dark:hover:text-white hover:text-gray-900" 
                                        />
                                        <MoreVertical className="w-5 h-5 dark:text-[#aebac1] text-gray-600 cursor-pointer dark:hover:text-white hover:text-gray-900" />
                                    </div>
                                </div>

                                {/* Messages - WhatsApp Style with Background Pattern */}
                                <div 
                                    className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4 space-y-3 dark:bg-[#0b141a] bg-gray-100"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03' class='dark:fill-white'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                                    }}
                                >
                                    <AnimatePresence>
                                        {messages.map((message) => {
                                            const isOwn = message.senderId === user.userId;
                                            return (
                                                <motion.div
                                                    key={message.messageId}
                                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.8 }}
                                                    className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} group relative`}
                                                >
                                                    {/* Avatar for received messages (left side) */}
                                                    {!isOwn && (
                                                        <SafeAvatar
                                                            src={selectedUser?.avatar}
                                                            alt={selectedUser?.username}
                                                            fallbackText={selectedUser?.username}
                                                            className="w-8 h-8 rounded-full flex-shrink-0 ring-2 ring-primary/20"
                                                        />
                                                    )}
                                                    
                                                    <div className="relative">
                                                        <div className={`max-w-xs px-5 py-3 rounded-2xl backdrop-blur-xl shadow-lg border ${
                                                            isOwn 
                                                                ? 'bg-gradient-to-br from-primary/80 to-secondary/80 text-white rounded-br-none border-white/20' 
                                                                : 'dark:bg-white/5 bg-white/70 dark:text-white text-black rounded-bl-none dark:border-white/10 border-gray-200/50'
                                                        }`}>
                                                            {editingMessageId === message.messageId ? (
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={editingContent}
                                                                        onChange={(e) => setEditingContent(e.target.value)}
                                                                        className="flex-1 px-2 py-1 rounded bg-white/20 text-white placeholder-white/50 focus:outline-none"
                                                                        placeholder="Edit message..."
                                                                    />
                                                                    <button
                                                                        onClick={() => handleEditMessage(message.messageId)}
                                                                        className="px-2 py-1 bg-white/30 hover:bg-white/40 rounded text-sm"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {/* Media Content - Single or Multiple */}
                                                                    {message.mediaUrl && (
                                                                        <div className="mb-2">
                                                                            {Array.isArray(message.mediaUrl) ? (
                                                                                // Multiple media - grid layout
                                                                                <div className={`grid gap-1 rounded-lg overflow-hidden ${
                                                                                    message.mediaUrl.length === 1 ? 'grid-cols-1' :
                                                                                    message.mediaUrl.length === 2 ? 'grid-cols-2' :
                                                                                    message.mediaUrl.length === 3 ? 'grid-cols-2' :
                                                                                    'grid-cols-2'
                                                                                }`} style={{ maxWidth: '280px' }}>
                                                                                    {message.mediaUrl.slice(0, 4).map((url, idx) => {
                                                                                        const isVideo = message.mediaType?.[idx] === 'video' || url.includes('.mp4') || url.includes('.webm');
                                                                                        const isLastWithMore = idx === 3 && message.mediaUrl.length > 4;
                                                                                        return (
                                                                                            <div 
                                                                                                key={idx} 
                                                                                                className={`relative overflow-hidden ${
                                                                                                    message.mediaUrl.length === 3 && idx === 0 ? 'col-span-2' : ''
                                                                                                }`}
                                                                                                style={{ aspectRatio: message.mediaUrl.length === 1 ? 'auto' : '1' }}
                                                                                            >
                                                                                                {isVideo ? (
                                                                                                    <video 
                                                                                                        src={url} 
                                                                                                        controls 
                                                                                                        controlsList="nodownload nofullscreen noremoteplayback"
                                                                                                        disablePictureInPicture
                                                                                                        onContextMenu={(e) => e.preventDefault()}
                                                                                                        className="w-full h-full object-cover"
                                                                                                    />
                                                                                                ) : (
                                                                                                    <img 
                                                                                                        src={url} 
                                                                                                        alt="Media" 
                                                                                                        className={`w-full h-full cursor-pointer hover:opacity-90 transition-all ${
                                                                                                            message.mediaUrl.length === 1 ? 'max-h-64 object-contain' : 'object-cover'
                                                                                                        }`}
                                                                                                        onClick={() => setFullScreenImage(url)}
                                                                                                    />
                                                                                                )}
                                                                                                {isLastWithMore && (
                                                                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl">
                                                                                                        +{message.mediaUrl.length - 4}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            ) : (
                                                                                // Single media
                                                                                message.mediaType === 'video' ? (
                                                                                    <video 
                                                                                        src={message.mediaUrl} 
                                                                                        controls 
                                                                                        controlsList="nodownload nofullscreen noremoteplayback"
                                                                                        disablePictureInPicture
                                                                                        onContextMenu={(e) => e.preventDefault()}
                                                                                        className="max-w-full rounded-lg max-h-64"
                                                                                    />
                                                                                ) : (
                                                                                    <img 
                                                                                        src={message.mediaUrl} 
                                                                                        alt="Media" 
                                                                                        className="max-w-full rounded-lg max-h-64 cursor-pointer hover:opacity-90 transition-all"
                                                                                        onClick={() => setFullScreenImage(message.mediaUrl)}
                                                                                    />
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-start justify-between gap-2 w-full">
                                                                        {message.content && (
                                                                            <p className="break-words text-sm leading-relaxed flex-1 overflow-hidden">
                                                                                {message.content.split(/([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}])/gu).map((part, idx) => {
                                                                                    const isEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(part);
                                                                                    return isEmoji ? (
                                                                                        <span key={idx} className="text-3xl inline-block align-middle">{part}</span>
                                                                                    ) : (
                                                                                        <span key={idx}>{part}</span>
                                                                                    );
                                                                                })}
                                                                            </p>
                                                                        )}
                                                                        {/* Message Menu Button - Inside bubble */}
                                                                        {isOwn && (
                                                                            <button
                                                                                onClick={() => setShowMessageMenu(showMessageMenu === message.messageId ? null : message.messageId)}
                                                                                className="flex-shrink-0 p-1 rounded-full hover:bg-black/20 transition-all"
                                                                            >
                                                                                <MoreVertical className="w-4 h-4 text-black/60 dark:text-white/80" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center justify-end gap-1.5 mt-1">
                                                                        <span className={`text-[10px] whitespace-nowrap ${isOwn ? 'text-black/60 dark:text-white/70' : 'dark:text-white/50 text-black/60'}`}>
                                                                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                        {isOwn && (
                                                                            <motion.div
                                                                                whileHover={{ scale: 1.1 }}
                                                                                className="cursor-pointer"
                                                                            >
                                                                                {message.sending ? (
                                                                                    <div className="w-3.5 h-3.5 border-2 border-black/40 dark:border-white/50 border-t-transparent rounded-full animate-spin" />
                                                                                ) : message.read ? (
                                                                                    <Eye className="w-3.5 h-3.5 text-black/60 dark:text-white/70" />
                                                                                ) : (
                                                                                    <EyeOff className="w-3.5 h-3.5 text-black/40 dark:text-white/50" />
                                                                                )}
                                                                            </motion.div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Dropdown Menu */}
                                                        <AnimatePresence>
                                                            {showMessageMenu === message.messageId && isOwn && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                                    className="absolute top-full right-0 mt-2 bg-white dark:bg-[#202c33] rounded-lg shadow-lg border dark:border-[#2a3942] border-gray-200 overflow-hidden z-50"
                                                                >
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingMessageId(message.messageId);
                                                                            setEditingContent(message.content);
                                                                        }}
                                                                        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-[#2a3942] text-gray-900 dark:text-white transition-colors text-sm"
                                                                    >
                                                                        <Edit2 className="w-4 h-4" />
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteMessage(message.messageId)}
                                                                        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors text-sm"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                        Delete
                                                                    </button>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                    
                                                    {/* Avatar for sent messages (right side) */}
                                                    {isOwn && (
                                                        <SafeAvatar
                                                            src={user?.avatar}
                                                            alt={user?.username}
                                                            fallbackText={user?.username}
                                                            className="w-8 h-8 rounded-full flex-shrink-0 ring-2 ring-primary/20"
                                                        />
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* WhatsApp Message Input */}
                                <div className="relative">
                                    {/* Emoji Picker */}
                                    {showEmojiPicker && (
                                        <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#202c33] rounded-lg shadow-xl border dark:border-[#2a3942] p-3 z-50 w-[340px]">
                                            <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto scrollbar-hide pr-2">
                                                {['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '✨', '💫', '⭐', '🌟', '💯', '✅', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉'].map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        type="button"
                                                        onClick={() => {
                                                            setNewMessage(prev => prev + emoji);
                                                            setShowEmojiPicker(false);
                                                        }}
                                                        className="text-2xl hover:bg-gray-100 dark:hover:bg-[#2a3942] p-2 rounded transition-colors"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Telegram-style Media Preview with Numbers */}
                                    {mediaPreview.length > 0 && (
                                        <div className="dark:bg-[#202c33] bg-white px-3 py-3 border-t dark:border-[#2a3942] border-gray-200">
                                            {/* Header with count, three dots menu, and close button */}
                                            <div className="flex items-center justify-between mb-3">
                                                {/* Left side - photo count */}
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {mediaPreview.length} {mediaPreview.length === 1 ? 'photo' : 'photos'} selected
                                                </span>
                                                
                                                {/* Right side - Three dots menu and Close button */}
                                                <div className="flex items-center gap-1">
                                                    {/* Three dots menu */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowMediaOptionsMenu(!showMediaOptionsMenu)}
                                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2a3942] rounded-full transition-colors"
                                                    >
                                                        <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                                    </button>
                                                    
                                                    {/* Close button */}
                                                    <button
                                                        type="button"
                                                        onClick={clearMediaPreview}
                                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2a3942] rounded-full transition-colors"
                                                    >
                                                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Three dots dropdown menu */}
                                            <AnimatePresence>
                                                {showMediaOptionsMenu && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setShowMediaOptionsMenu(false)} />
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.95 }}
                                                            className="absolute right-3 top-12 bg-white dark:bg-[#202c33] rounded-xl shadow-2xl border dark:border-[#2a3942] border-gray-200 overflow-hidden z-50 min-w-[200px]"
                                                        >
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
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    setShowMediaOptionsMenu(false);
                                                                    if (selectedMedia.length === 0 || !selectedUser) return;
                                                                    setIsUploading(true);
                                                                    for (let i = 0; i < selectedMedia.length; i++) {
                                                                        const file = selectedMedia[i];
                                                                        const preview = mediaPreview[i];
                                                                        const tempId = `temp-${Date.now()}-${i}`;
                                                                        const tempMessage = {
                                                                            messageId: tempId, senderId: user.userId, receiverId: selectedUser.userId,
                                                                            content: '', mediaUrl: preview.url, mediaType: preview.type,
                                                                            createdAt: new Date().toISOString(), read: false, sending: true
                                                                        };
                                                                        setMessages(prev => [...prev, tempMessage]);
                                                                        try {
                                                                            const token = localStorage.getItem("token");
                                                                            const url = await uploadMedia(file);
                                                                            const res = await axios.post("/api/messages", {
                                                                                receiverId: selectedUser.userId, content: '', mediaUrl: url, mediaType: preview.type
                                                                            }, { headers: { Authorization: `Bearer ${token}` } });
                                                                            setMessages(prev => prev.map(msg => msg.messageId === tempId ? res.data : msg));
                                                                            if (socket) socket.emit("sendMessage", { ...res.data });
                                                                        } catch (error) {
                                                                            setMessages(prev => prev.filter(msg => msg.messageId !== tempId));
                                                                        }
                                                                    }
                                                                    toast.success(`${selectedMedia.length} files sent individually!`);
                                                                    clearMediaPreview();
                                                                    fetchConversations();
                                                                    setIsUploading(false);
                                                                }}
                                                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                            >
                                                                <Grid3X3 className="w-5 h-5 text-[#3390ec]" />
                                                                <span className="text-gray-900 dark:text-white font-medium">Send without grouping</span>
                                                            </button>
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                            
                                            {/* Photos Grid with Numbers - Telegram Style */}
                                            <div className="flex gap-2 flex-wrap mb-3 items-center">
                                                {mediaPreview.map((preview, idx) => (
                                                    <div key={idx} className="relative group">
                                                        {preview.type === 'image' ? (
                                                            <img 
                                                                src={preview.url} 
                                                                alt={`Preview ${idx + 1}`} 
                                                                className="h-16 w-16 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                                onClick={() => {
                                                                    setCurrentPreviewIndex(idx);
                                                                    setShowMediaPreviewModal(true);
                                                                }}
                                                            />
                                                        ) : (
                                                            <video 
                                                                src={preview.url} 
                                                                className="h-16 w-16 object-cover rounded-lg"
                                                            />
                                                        )}
                                                        {/* Number Badge - Telegram Style */}
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#3390ec] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                                            {idx + 1}
                                                        </div>
                                                        {/* Remove button on hover */}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                URL.revokeObjectURL(preview.url);
                                                                setMediaPreview(prev => prev.filter((_, i) => i !== idx));
                                                                setSelectedMedia(prev => prev.filter((_, i) => i !== idx));
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
                                                    onClick={() => {
                                                        if (fileInputRef.current) {
                                                            fileInputRef.current.value = '';
                                                        }
                                                        fileInputRef.current?.click();
                                                    }}
                                                    className="h-16 w-16 rounded-lg border-2 border-dashed dark:border-gray-600 border-gray-300 flex items-center justify-center dark:text-gray-400 text-gray-500 hover:dark:border-gray-500 hover:border-gray-400 transition-colors"
                                                >
                                                    <span className="text-2xl">+</span>
                                                </button>
                                            </div>
                                            
                                            {/* Send Button */}
                                            <button
                                                type="button"
                                                onClick={handleSendMediaMessage}
                                                disabled={isUploading}
                                                className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 ${
                                                    isUploading 
                                                        ? 'bg-[#00a884]/50 cursor-not-allowed' 
                                                        : 'bg-[#00a884] hover:bg-[#06cf9c]'
                                                } text-white transition-colors`}
                                            >
                                                <Send className="w-4 h-4" />
                                                {isUploading ? 'Sending...' : `Send ${selectedMedia.length} ${selectedMedia.length === 1 ? 'Photo' : 'Photos'}`}
                                            </button>
                                        </div>
                                    )}
                                    
                                    <form onSubmit={handleSendMessage} className="dark:bg-[#202c33] bg-white px-3 py-2 border-t dark:border-[#2a3942] border-gray-200 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="dark:text-[#8696a0] text-gray-600 dark:hover:text-white hover:text-gray-900 p-2"
                                        >
                                            <Smile className="w-6 h-6" />
                                        </button>
                                        {/* Hidden file inputs */}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <input
                                            ref={documentInputRef}
                                            type="file"
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        {/* Telegram-style Attachment Menu */}
                                        <div className="relative">
                                            <button 
                                                type="button" 
                                                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                                className="dark:text-[#8696a0] text-gray-600 dark:hover:text-white hover:text-gray-900 p-2"
                                            >
                                                <Paperclip className="w-6 h-6" />
                                            </button>
                                            
                                            {/* Telegram-style Attachment Popup - Full Modal for PC */}
                                            <AnimatePresence>
                                                {showAttachmentMenu && (
                                                    <>
                                                        {/* Dark Backdrop */}
                                                        <motion.div 
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            className="fixed inset-0 bg-black/50 z-[100]"
                                                            onClick={() => setShowAttachmentMenu(false)}
                                                        />
                                                        
                                                        {/* Telegram-style Modal - Mobile friendly positioning */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 100 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 100 }}
                                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                                            className="fixed left-0 right-0 bottom-0 md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 bg-white dark:bg-[#202c33] rounded-t-2xl md:rounded-2xl shadow-2xl border dark:border-[#2a3942] border-gray-200 overflow-hidden z-[101] w-full md:w-[90vw] md:max-w-[500px] max-h-[70vh] md:max-h-[85vh] overflow-y-auto"
                                                        >
                                                            {/* Header */}
                                                            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-[#2a3942] border-gray-200 sticky top-0 bg-white dark:bg-[#202c33] z-10">
                                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                                    {mediaPreview.length > 0 
                                                                        ? `${mediaPreview.length} ${mediaPreview.length === 1 ? 'photo' : 'photos'} selected`
                                                                        : 'Send File'
                                                                    }
                                                                </h3>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowAttachmentMenu(false)}
                                                                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                                >
                                                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                                                </button>
                                                            </div>
                                                            
                                                            <div className="p-4">
                                                                {/* Selected Photos Grid with Numbers - Telegram Style */}
                                                                {mediaPreview.length > 0 && (
                                                                    <div className="mb-4">
                                                                        <div className="grid grid-cols-4 gap-2 mb-4">
                                                                            {mediaPreview.map((preview, idx) => (
                                                                                <div key={idx} className="relative group aspect-square">
                                                                                    {preview.type === 'image' ? (
                                                                                        <img 
                                                                                            src={preview.url} 
                                                                                            alt={`Preview ${idx + 1}`} 
                                                                                            className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                                                            onClick={() => {
                                                                                                setCurrentPreviewIndex(idx);
                                                                                                setShowMediaPreviewModal(true);
                                                                                                setShowAttachmentMenu(false);
                                                                                            }}
                                                                                        />
                                                                                    ) : (
                                                                                        <video 
                                                                                            src={preview.url} 
                                                                                            className="w-full h-full object-cover rounded-lg"
                                                                                        />
                                                                                    )}
                                                                                    {/* Number Badge - Telegram Style */}
                                                                                    <div className="absolute top-1 right-1 w-6 h-6 bg-[#3390ec] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                                                                        {idx + 1}
                                                                                    </div>
                                                                                    {/* Remove button on hover */}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            URL.revokeObjectURL(preview.url);
                                                                                            setMediaPreview(prev => prev.filter((_, i) => i !== idx));
                                                                                            setSelectedMedia(prev => prev.filter((_, i) => i !== idx));
                                                                                        }}
                                                                                        className="absolute bottom-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                    >
                                                                                        <X className="w-3 h-3" />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                            {/* Add more button in grid */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                                                    fileInputRef.current?.click();
                                                                                }}
                                                                                className="aspect-square rounded-lg border-2 border-dashed dark:border-gray-600 border-gray-300 flex items-center justify-center dark:text-gray-400 text-gray-500 hover:dark:border-gray-500 hover:border-gray-400 transition-colors"
                                                                            >
                                                                                <span className="text-3xl">+</span>
                                                                            </button>
                                                                        </div>
                                                                        
                                                                        {/* Send Button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setShowAttachmentMenu(false);
                                                                                handleSendMediaMessage();
                                                                            }}
                                                                            disabled={isUploading}
                                                                            className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 mb-4 ${
                                                                                isUploading 
                                                                                    ? 'bg-[#00a884]/50 cursor-not-allowed' 
                                                                                    : 'bg-[#00a884] hover:bg-[#06cf9c]'
                                                                            } text-white transition-colors`}
                                                                        >
                                                                            <Send className="w-4 h-4" />
                                                                            {isUploading ? 'Sending...' : `Send ${selectedMedia.length} ${selectedMedia.length === 1 ? 'Photo' : 'Photos'}`}
                                                                        </button>
                                                                        
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Quick Actions Grid - Only show when no photos selected */}
                                                                {mediaPreview.length === 0 && (
                                                                <div className="grid grid-cols-4 gap-3 mb-4">
                                                                    {/* Photo & Video */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                                                            fileInputRef.current?.click();
                                                                        }}
                                                                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                                    >
                                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                                                                            <Image className="w-6 h-6 text-white" />
                                                                        </div>
                                                                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Gallery</span>
                                                                    </button>
                                                                    
                                                                    {/* Document */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (documentInputRef.current) documentInputRef.current.value = '';
                                                                            documentInputRef.current?.click();
                                                                        }}
                                                                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                                    >
                                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg">
                                                                            <FileText className="w-6 h-6 text-white" />
                                                                        </div>
                                                                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">File</span>
                                                                    </button>
                                                                    
                                                                    {/* Camera */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            toast.info("Camera feature coming soon!");
                                                                            setShowAttachmentMenu(false);
                                                                        }}
                                                                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                                    >
                                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
                                                                            <Camera className="w-6 h-6 text-white" />
                                                                        </div>
                                                                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Camera</span>
                                                                    </button>
                                                                    
                                                                    {/* Location */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            toast.info("Location sharing coming soon!");
                                                                            setShowAttachmentMenu(false);
                                                                        }}
                                                                        className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                                    >
                                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                                                                            <MapPin className="w-6 h-6 text-white" />
                                                                        </div>
                                                                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Location</span>
                                                                    </button>
                                                                </div>
                                                                )}
                                                                
                                                                {/* Drag & Drop Area - PC Feature - Only show when no photos selected */}
                                                                {mediaPreview.length === 0 && (
                                                                <div 
                                                                    className="border-2 border-dashed dark:border-[#3a4a54] border-gray-300 rounded-xl p-6 text-center hover:border-primary dark:hover:border-primary transition-colors cursor-pointer"
                                                                    onClick={() => {
                                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                                        fileInputRef.current?.click();
                                                                    }}
                                                                    onDragOver={(e) => {
                                                                        e.preventDefault();
                                                                        e.currentTarget.classList.add('border-primary', 'bg-primary/5');
                                                                    }}
                                                                    onDragLeave={(e) => {
                                                                        e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                                                                    }}
                                                                    onDrop={(e) => {
                                                                        e.preventDefault();
                                                                        e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                                                                        const files = e.dataTransfer.files;
                                                                        if (files.length > 0) {
                                                                            const event = { target: { files } };
                                                                            handleFileSelect(event);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-[#2a3942] flex items-center justify-center">
                                                                        <Image className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                                                    </div>
                                                                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">
                                                                        Drag files here or click to browse
                                                                    </p>
                                                                    <p className="text-gray-400 dark:text-gray-500 text-xs">
                                                                        Images, Videos, Documents (Max 10MB each)
                                                                    </p>
                                                                </div>
                                                                )}
                                                                
                                                                {/* Audio Option */}
                                                                {mediaPreview.length === 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        toast.info("Audio feature coming soon!");
                                                                        setShowAttachmentMenu(false);
                                                                    }}
                                                                    className="w-full mt-3 px-4 py-3 flex items-center gap-3 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2a3942] transition-colors"
                                                                >
                                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                                                                        <Music className="w-5 h-5 text-white" />
                                                                    </div>
                                                                    <span className="text-gray-900 dark:text-white font-medium">Send Audio</span>
                                                                </button>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Type a message"
                                            className="flex-1 dark:bg-[#2a3942] bg-gray-100 dark:text-white text-gray-900 dark:placeholder-[#8696a0] placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                        />
                                        {newMessage.trim() ? (
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
                                            <button type="button" className="dark:text-[#8696a0] text-gray-600 dark:hover:text-white hover:text-gray-900 p-2">
                                                <Mic className="w-6 h-6" />
                                            </button>
                                        )}
                                        </div>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center dark:text-[#8696a0] text-gray-600 p-8">
                                <div className="w-64 h-64 mb-8 opacity-20">
                                    <svg viewBox="0 0 303 172" fill="currentColor">
                                        <path d="M229.5 0C260.5 0 285 24.5 285 55.5V116.5C285 147.5 260.5 172 229.5 172H73.5C42.5 172 18 147.5 18 116.5V55.5C18 24.5 42.5 0 73.5 0H229.5ZM152 43C127 43 107 63 107 88C107 113 127 133 152 133C177 133 197 113 197 88C197 63 177 43 152 43Z"/>
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-light mb-2 dark:text-[#e9edef] text-gray-900">Buddylynk Web</h3>
                                <p className="text-sm text-center max-w-md">
                                    Send and receive messages without keeping your phone online.
                                </p>
                                <p className="text-sm text-center max-w-md mt-4">
                                    Select a chat to start messaging
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Call Modal */}
            {isCallModalOpen && selectedUser && (
                <CallModal
                    isOpen={isCallModalOpen}
                    onClose={() => {
                        setIsCallModalOpen(false);
                        setIsIncomingCall(false);
                        setIncomingCallData(null);
                    }}
                    callType={callType}
                    caller={isIncomingCall ? incomingCallData?.from : user}
                    receiver={isIncomingCall ? user : selectedUser}
                    socket={socket}
                    isIncoming={isIncomingCall}
                    incomingOffer={incomingCallData?.offer}
                />
            )}

            {/* Delete Message Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false);
                    setMessageToDelete(null);
                }}
                onConfirm={executeDeleteMessage}
                title="Delete Message?"
                message="This message will be permanently deleted. This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
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
                        <button
                            onClick={() => setFullScreenImage(null)}
                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>
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
                {showMediaPreviewModal && mediaPreview.length > 0 && (
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
                                <span className="text-white/60"> - {mediaPreview.length} {mediaPreview.length === 1 ? 'photo' : 'photos'}</span>
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
                                    {mediaPreview.length === 1 ? (
                                        /* Single image - full size */
                                        <div className="rounded-xl overflow-hidden">
                                            {mediaPreview[0].type === 'video' ? (
                                                <video src={mediaPreview[0].url} className="w-full max-h-[300px] object-contain" />
                                            ) : (
                                                <img src={mediaPreview[0].url} alt="Preview" className="w-full max-h-[300px] object-contain" />
                                            )}
                                        </div>
                                    ) : mediaPreview.length === 2 ? (
                                        /* 2 images - side by side */
                                        <div className="grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden">
                                            {mediaPreview.map((preview, idx) => (
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
                                                {mediaPreview[0].type === 'video' ? (
                                                    <video src={mediaPreview[0].url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <img src={mediaPreview[0].url} alt="Preview 1" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            {/* Small images row */}
                                            <div className={`grid gap-0.5 ${
                                                mediaPreview.length === 3 ? 'grid-cols-2' :
                                                mediaPreview.length === 4 ? 'grid-cols-3' :
                                                mediaPreview.length >= 5 ? 'grid-cols-4' : 'grid-cols-3'
                                            }`}>
                                                {mediaPreview.slice(1, 5).map((preview, idx) => {
                                                    const isLast = idx === 3 && mediaPreview.length > 5;
                                                    return (
                                                        <div key={idx + 1} className="aspect-square relative">
                                                            {preview.type === 'video' ? (
                                                                <video src={preview.url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <img src={preview.url} alt={`Preview ${idx + 2}`} className="w-full h-full object-cover" />
                                                            )}
                                                            {isLast && (
                                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg">
                                                                    +{mediaPreview.length - 5}
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
                                    This is how your {mediaPreview.length} {mediaPreview.length === 1 ? 'photo' : 'photos'} will appear
                                </p>
                            </div>
                        </div>
                        
                        {/* Thumbnail Strip */}
                        <div className="px-4 py-3 bg-black/50">
                            <div className="flex gap-2 justify-center overflow-x-auto pb-2">
                                {mediaPreview.map((preview, idx) => (
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
                                onClick={() => {
                                    setShowMediaPreviewModal(false);
                                    handleSendMediaMessage();
                                }}
                                disabled={isUploading}
                                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                                    isUploading 
                                        ? 'bg-[#3390ec]/50 cursor-not-allowed' 
                                        : 'bg-[#3390ec] hover:bg-[#2b7fd4]'
                                } text-white transition-colors`}
                            >
                                <Layers className="w-5 h-5" />
                                {isUploading ? 'Sending...' : `Send as Group (${mediaPreview.length})`}
                            </button>
                            <button
                                onClick={async () => {
                                    setShowMediaPreviewModal(false);
                                    if (selectedMedia.length === 0 || !selectedUser) return;
                                    setIsUploading(true);
                                    
                                    for (let i = 0; i < selectedMedia.length; i++) {
                                        const file = selectedMedia[i];
                                        const preview = mediaPreview[i];
                                        const tempId = `temp-${Date.now()}-${i}`;
                                        
                                        const tempMessage = {
                                            messageId: tempId,
                                            senderId: user.userId,
                                            receiverId: selectedUser.userId,
                                            content: '',
                                            mediaUrl: preview.url,
                                            mediaType: preview.type,
                                            createdAt: new Date().toISOString(),
                                            read: false,
                                            sending: true
                                        };
                                        setMessages(prev => [...prev, tempMessage]);
                                        
                                        try {
                                            const token = localStorage.getItem("token");
                                            const url = await uploadMedia(file);
                                            
                                            const res = await axios.post("/api/messages", {
                                                receiverId: selectedUser.userId,
                                                content: '',
                                                mediaUrl: url,
                                                mediaType: preview.type
                                            }, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            
                                            setMessages(prev => prev.map(msg => 
                                                msg.messageId === tempId ? res.data : msg
                                            ));
                                            
                                            if (socket) {
                                                socket.emit("sendMessage", { ...res.data });
                                            }
                                        } catch (error) {
                                            console.error(`Error sending file ${i + 1}:`, error);
                                            setMessages(prev => prev.filter(msg => msg.messageId !== tempId));
                                        }
                                    }
                                    
                                    toast.success(`${selectedMedia.length} files sent individually!`);
                                    clearMediaPreview();
                                    fetchConversations();
                                    setIsUploading(false);
                                }}
                                disabled={isUploading}
                                className="flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <Grid3X3 className="w-5 h-5" />
                                Send Without Grouping
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default Chat;
