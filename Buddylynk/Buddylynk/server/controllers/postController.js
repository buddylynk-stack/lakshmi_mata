const Post = require("../models/Post");
const User = require("../models/User");
const PostView = require("../models/PostView");
const Notification = require("../models/Notification");
const { uploadToS3 } = require("../middleware/uploadMiddleware");

const createPost = async (req, res) => {
    try {
        const { content, pollOptions } = req.body;
        const media = [];
        const socketService = req.app.get("socketService");
        const userId = req.user.userId;

        console.log(`\n📝 Creating new post...`);

        // Handle multiple files
        if (req.files && req.files.length > 0) {
            console.log(`📎 ${req.files.length} media file(s) detected`);
            const totalFiles = req.files.length;
            
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                
                // Emit progress for file upload start
                socketService.sendUploadProgress(userId, {
                    stage: "uploading",
                    currentFile: i + 1,
                    totalFiles: totalFiles,
                    progress: Math.round(((i) / totalFiles) * 80), // 0-80% for uploads
                    message: `Uploading file ${i + 1} of ${totalFiles}...`
                });

                const mediaUrl = await uploadToS3(file);
                const mediaType = file.mimetype.startsWith("image") ? "image" : "video";
                media.push({ url: mediaUrl, type: mediaType });
                console.log(`   ✅ ${mediaType}: ${mediaUrl}`);
                
                // Emit progress after each file
                socketService.sendUploadProgress(userId, {
                    stage: "uploading",
                    currentFile: i + 1,
                    totalFiles: totalFiles,
                    progress: Math.round(((i + 1) / totalFiles) * 80),
                    message: `Uploaded ${i + 1} of ${totalFiles} files`
                });
            }
        }

        const user = await User.getUserById(req.user.userId);

        const postData = {
            userId: req.user.userId,
            username: user.username,
            userAvatar: user.avatar,
            content,
            media,
        };

        // Add poll options if provided (format: comma-separated string or array)
        if (pollOptions) {
            if (typeof pollOptions === 'string') {
                postData.pollOptions = pollOptions.split(',').map(opt => opt.trim()).filter(opt => opt);
            } else {
                postData.pollOptions = pollOptions;
            }
        }

        // Emit progress for saving to database
        socketService.sendUploadProgress(userId, {
            stage: "saving",
            progress: 90,
            message: "Saving post to database..."
        });

        const newPost = await Post.createPost(postData);
        console.log(`✅ Post created successfully with ${media.length} media item(s)\n`);

        // Emit completion
        socketService.sendUploadProgress(userId, {
            stage: "complete",
            progress: 100,
            message: "Post created successfully!"
        });

        // Broadcast new post to ALL users via Redis PUB/SUB
        // This ensures all connected clients (across all server instances) receive the update
        await socketService.publishEvent(socketService.CHANNELS.POST_CREATED, newPost);
        console.log(`📡 Published new post to Redis: ${newPost.postId}`);

        res.status(201).json(newPost);
    } catch (error) {
        console.error('❌ Post creation failed:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Create post with pre-uploaded S3 URLs (for direct browser-to-S3 uploads - no file size limit)
const createPostWithUrls = async (req, res) => {
    try {
        const { content, media, pollOptions } = req.body;
        const socketService = req.app.get("socketService");

        console.log(`\n📝 Creating new post with direct S3 URLs...`);
        console.log(`📎 ${media?.length || 0} media URL(s) provided`);

        const user = await User.getUserById(req.user.userId);

        const postData = {
            userId: req.user.userId,
            username: user.username,
            userAvatar: user.avatar,
            content,
            media: media || [],
        };

        // Add poll options if provided
        if (pollOptions && Array.isArray(pollOptions) && pollOptions.length >= 2) {
            postData.pollOptions = pollOptions.filter(opt => opt.trim());
        }

        const newPost = await Post.createPost(postData);
        console.log(`✅ Post created successfully with ${media?.length || 0} media item(s)\n`);

        // Broadcast new post to ALL users via Redis PUB/SUB
        await socketService.publishEvent(socketService.CHANNELS.POST_CREATED, newPost);
        console.log(`📡 Published new post to Redis: ${newPost.postId}`);

        res.status(201).json(newPost);
    } catch (error) {
        console.error('❌ Post creation failed:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getPosts = async (req, res) => {
    try {
        const posts = await Post.getAllPosts();
        res.json(posts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getPostById = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.getPostById(id);
        
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        
        res.json(post);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const votePoll = async (req, res) => {
    try {
        const { id } = req.params; // postId
        const { optionId } = req.body;
        const userId = req.user.userId;

        const updatedPost = await Post.votePoll(id, optionId, userId);

        // Broadcast update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message || "Voting error" });
    }
};

const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        await Post.deletePost(id);
        
        // Broadcast deletion via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.POST_DELETED, id);
        
        res.json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const likePost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const updatedPost = await Post.likePost(id, userId);
        const socketService = req.app.get("socketService");

        // Create notification if user liked (not unliked) and it's not their own post
        if (updatedPost.likedBy && updatedPost.likedBy.includes(userId) && updatedPost.userId !== userId) {
            const user = await User.getUserById(userId);
            const notification = await Notification.createNotification({
                userId: updatedPost.userId,
                type: "like",
                fromUserId: userId,
                fromUsername: user.username,
                fromUserAvatar: user.avatar,
                postId: id,
            });

            // Send notification via Redis PUB/SUB
            await socketService.publishEvent(socketService.CHANNELS.NOTIFICATION, {
                userId: updatedPost.userId,
                notification
            });
        }

        // Broadcast update via Redis PUB/SUB
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const commentPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const user = await User.getUserById(req.user.userId);
        const updatedPost = await Post.addComment(id, req.user.userId, user.username, user.avatar, content);
        const socketService = req.app.get("socketService");

        // Create notification if it's not their own post
        if (updatedPost.userId !== req.user.userId) {
            const notification = await Notification.createNotification({
                userId: updatedPost.userId,
                type: "comment",
                fromUserId: req.user.userId,
                fromUsername: user.username,
                fromUserAvatar: user.avatar,
                postId: id,
                message: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
            });

            // Send notification via Redis PUB/SUB
            await socketService.publishEvent(socketService.CHANNELS.NOTIFICATION, {
                userId: updatedPost.userId,
                notification
            });
        }

        // Broadcast update via Redis PUB/SUB
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const editComment = async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;

        const updatedPost = await Post.editComment(id, commentId, userId, content);

        // Broadcast update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

const deleteComment = async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const userId = req.user.userId;

        const updatedPost = await Post.deleteComment(id, commentId, userId);

        // Broadcast update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

const pinComment = async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const userId = req.user.userId;

        const updatedPost = await Post.pinComment(id, commentId, userId);

        // Broadcast update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(403).json({ message: error.message || "Server error" });
    }
};

const sharePost = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedPost = await Post.sharePost(id);

        // Broadcast update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const savePost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const updatedPost = await Post.savePost(id, userId);

        // Broadcast update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);

        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const viewPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { duration } = req.body;
        const userId = req.user?.userId || null; // Allow anonymous views

        // Collect metadata for fraud detection
        const metadata = {
            duration: duration || 0,
            deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop',
            userAgent: req.headers['user-agent'] || 'unknown',
            ipHash: req.ip ? require('crypto').createHash('sha256').update(req.ip).digest('hex').substring(0, 16) : null
        };

        // Record view in separate PostViews table (secure, tamper-proof)
        // For anonymous users, use IP hash as identifier
        const viewResult = await PostView.recordView(id, userId, metadata);

        // Only increment post view count if it's a new unique view
        if (viewResult.isNewView) {
            await Post.incrementViews(id, userId);
        }

        // Get updated view count from PostViews table
        const viewStats = await PostView.getPostViewCount(id);

        // Broadcast view update via Redis PUB/SUB (optional - only if needed)
        // Note: View updates are high-frequency, so we might skip broadcasting to reduce load
        // Uncomment if real-time view counts are critical
        /*
        const socketService = req.app.get("socketService");
        await socketService.publishEvent("post:view:updated", {
            postId: id,
            uniqueViewers: viewStats.uniqueViewers,
            totalViews: viewStats.totalViews
        });
        */

        res.json({
            postId: id,
            isNewView: viewResult.isNewView,
            uniqueViewers: viewStats.uniqueViewers,
            totalViews: viewStats.totalViews,
            userViewCount: viewResult.viewCount
        });
    } catch (error) {
        console.error("Error recording view:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const editPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, removeMedia } = req.body;
        const media = [];

        // Handle multiple new files
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const mediaUrl = await uploadToS3(file);
                const mediaType = file.mimetype.startsWith("image") ? "image" : "video";
                media.push({ url: mediaUrl, type: mediaType });
            }
        }

        const updatedPost = await Post.editPost(id, content, removeMedia === "true" ? [] : (media.length > 0 ? media : null));
        
        // Broadcast update via Redis PUB/SUB
        const socketService = req.app.get("socketService");
        await socketService.publishEvent(socketService.CHANNELS.POST_UPDATED, updatedPost);
        
        console.log(`✅ Post edited: ${id}`);
        
        res.json(updatedPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const getPostAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        // Get the post to verify ownership or admin access
        const post = await Post.getPostById(id);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Only post owner can see detailed analytics
        if (post.userId !== userId) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Get comprehensive analytics
        const analytics = await PostView.getViewAnalytics(id);

        res.json(analytics);
    } catch (error) {
        console.error("Error getting analytics:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { createPost, createPostWithUrls, getPosts, getPostById, votePoll, deletePost, likePost, commentPost, editComment, deleteComment, pinComment, sharePost, savePost, viewPost, editPost, getPostAnalytics };
