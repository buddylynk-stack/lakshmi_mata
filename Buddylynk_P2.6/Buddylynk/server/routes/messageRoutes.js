const express = require("express");
const { getConversations, getMessages, sendMessage, markAsRead, getUnreadCount, syncUnreadCount, editMessage, deleteMessage } = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/conversations", protect, getConversations);
router.get("/unread-count", protect, getUnreadCount);
router.post("/sync-unread-count", protect, syncUnreadCount);
router.get("/:userId", protect, getMessages);
router.post("/", protect, sendMessage);
router.post("/mark-read/:userId", protect, markAsRead);
router.put("/:messageId", protect, editMessage);
router.delete("/:messageId", protect, deleteMessage);

module.exports = router;
