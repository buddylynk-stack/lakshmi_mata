const express = require("express");
const { createPost, getPosts, getPostById, votePoll, deletePost, likePost, commentPost, editComment, deleteComment, pinComment, sharePost, savePost, viewPost, editPost, getPostAnalytics } = require("../controllers/postController");
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/", getPosts);
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
router.post("/:id/view", protect, viewPost); // Protected to track unique users
router.get("/:id/analytics", protect, getPostAnalytics); // Get view analytics (owner only)
router.put("/:id", protect, upload.array("media", 10), editPost); // Allow up to 10 files
router.delete("/:id", protect, deletePost);

module.exports = router;
