const express = require("express");
const { createPost, getPosts, getPostById, getFeed, votePoll, deletePost, likePost, commentPost, editComment, deleteComment, pinComment, sharePost, savePost, viewPost, editPost, getPostAnalytics, trackUserInteraction } = require("../controllers/postController");
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");
const { healthCheck: recommendationHealth, getStats: getRecommendationStats } = require("../services/recommendationService");

const router = express.Router();

// Health check endpoint for ML services
router.get("/health", async (req, res) => {
    try {
        const recommendationStatus = await recommendationHealth();
        const nsfwApiUrl = process.env.NSFW_API_URL || 'not configured';
        const recommendationApiUrl = process.env.RECOMMENDATION_API_URL || 'not configured';
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                recommendation: {
                    ...recommendationStatus,
                    apiUrl: recommendationApiUrl
                },
                nsfw: {
                    apiUrl: nsfwApiUrl,
                    enabled: process.env.ENABLE_NSFW_CHECK !== 'false'
                }
            },
            stats: getRecommendationStats()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

router.get("/", getPosts);
router.get("/feed", optionalProtect, getFeed); // ML-powered feed with zigzag algorithm (MUST be before /:id)
router.post("/track", protect, trackUserInteraction); // Track interactions for ML
router.get("/:id", getPostById); // Get single post (public for sharing)
router.post("/", protect, upload.array("media", 10), createPost); // Allow up to 10 files
router.post("/with-urls", protect, require("../controllers/postController").createPostWithUrls); // Direct S3 upload - no file size limit
router.post("/:id/vote", protect, votePoll);
router.post("/:id/like", protect, likePost);
router.post("/:id/comment", protect, commentPost);
router.put("/:id/comment/:commentId", protect, editComment);
router.delete("/:id/comment/:commentId", protect, deleteComment);
router.post("/:id/comment/:commentId/pin", protect, pinComment);
router.post("/:id/share", protect, sharePost);
router.post("/:id/save", protect, savePost);
router.post("/:id/view", optionalProtect, viewPost); // Optional auth - tracks both authenticated and anonymous users
router.get("/:id/analytics", protect, getPostAnalytics); // Get view analytics (owner only)
router.put("/:id", protect, upload.array("media", 10), editPost); // Allow up to 10 files
router.delete("/:id", protect, deletePost);

// Admin endpoint to rescan all posts for NSFW content
router.post("/admin/rescan-nsfw", protect, require("../controllers/postController").rescanPostsForNSFW);

module.exports = router;
