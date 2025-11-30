const express = require("express");
const { getNotifications, markNotificationAsRead, clearAllNotifications } = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getNotifications);
router.put("/:id/read", protect, markNotificationAsRead);
router.delete("/clear-all", protect, clearAllNotifications);

module.exports = router;
