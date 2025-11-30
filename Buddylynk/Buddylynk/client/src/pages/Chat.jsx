import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useToast } from "../context/ToastContext";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Search, ArrowLeft, MoreVertical, Phone, Video, Paperclip, Smile, Mic, Eye, EyeOff, Edit2, Trash2, X } from "lucide-react";
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
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
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
        const file = e.target.files[0];
        if (!file) return;

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size must be less than 10MB");
            return;
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
        if (!validTypes.includes(file.type)) {
            toast.error("Only images and videos are allowed");
            return;
        }

        setSelectedMedia(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setMediaPreview({
                url: e.target.result,
                type: file.type.startsWith('video/') ? 'video' : 'image',
                name: file.name
            });
        };
        reader.readAsDataURL(file);
    };

    const clearMediaPreview = () => {
        setSelectedMedia(null);
        setMediaPreview(null);
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
        if (!selectedMedia || !selectedUser) return;

        setIsUploading(true);
        const tempId = `temp-${Date.now()}`;
        
        // Optimistic update with preview
        const tempMessage = {
            messageId: tempId,
            senderId: user.userId,
            receiverId: selectedUser.userId,
            content: '',
            mediaUrl: mediaPreview.url,
            mediaType: mediaPreview.type,
            createdAt: new Date().toISOString(),
            read: false,
            sending: true
        };
        setMessages(prev => [...prev, tempMessage]);
        
        try {
            // Upload media to S3
            const mediaUrl = await uploadMedia(selectedMedia);
            
            // Send message with media URL
            const token = localStorage.getItem("token");
            const res = await axios.post("/api/messages", {
                receiverId: selectedUser.userId,
                content: '',
                mediaUrl,
                mediaType: mediaPreview.type
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

            toast.success("Media sent!");
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
                                                                    {/* Media Content */}
                                                                    {message.mediaUrl && (
                                                                        <div className="mb-2">
                                                                            {message.mediaType === 'video' ? (
                                                                                <video 
                                                                                    src={message.mediaUrl} 
                                                                                    controls 
                                                                                    className="max-w-full rounded-lg max-h-64"
                                                                                />
                                                                            ) : (
                                                                                <img 
                                                                                    src={message.mediaUrl} 
                                                                                    alt="Media" 
                                                                                    className="max-w-full rounded-lg max-h-64 cursor-pointer"
                                                                                    onClick={() => window.open(message.mediaUrl, '_blank')}
                                                                                />
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
                                    
                                    {/* Media Preview */}
                                    {mediaPreview && (
                                        <div className="dark:bg-[#202c33] bg-white px-3 py-2 border-t dark:border-[#2a3942] border-gray-200">
                                            <div className="relative inline-block">
                                                {mediaPreview.type === 'image' ? (
                                                    <img 
                                                        src={mediaPreview.url} 
                                                        alt="Preview" 
                                                        className="max-h-32 rounded-lg"
                                                    />
                                                ) : (
                                                    <video 
                                                        src={mediaPreview.url} 
                                                        className="max-h-32 rounded-lg"
                                                        controls
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={clearMediaPreview}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendMediaMessage}
                                                disabled={isUploading}
                                                className={`mt-2 w-full py-2 rounded-lg text-white font-medium ${
                                                    isUploading 
                                                        ? 'bg-primary/50 cursor-not-allowed' 
                                                        : 'bg-primary hover:bg-primary/90'
                                                }`}
                                            >
                                                {isUploading ? 'Uploading...' : 'Send Media'}
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
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*,video/*"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="dark:text-[#8696a0] text-gray-600 dark:hover:text-white hover:text-gray-900 p-2"
                                        >
                                            <Paperclip className="w-6 h-6" />
                                        </button>
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
        </>
    );
};

export default Chat;
