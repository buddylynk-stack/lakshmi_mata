const express = require("express");
const { getUserProfile, updateProfile, blockUser, unblockUser, getBlockedUsers, updateSettings, followUser, unfollowUser, changePassword, getAllUsers, getBatchUsers, checkOnlineStatus, checkMultipleOnlineStatus } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/all", protect, getAllUsers); // Must be before /:id to avoid conflict
router.post("/batch", getBatchUsers); // Batch fetch user data
router.post("/online-status", checkMultipleOnlineStatus); // Check multiple users online status
router.get("/:id/online", checkOnlineStatus); // Check single user online status
router.get("/:id", getUserProfile);
router.put("/", protect, upload.fields([{ name: "avatar", maxCount: 1 }, { name: "banner", maxCount: 1 }]), updateProfile);
router.post("/block", protect, blockUser);
router.post("/unblock", protect, unblockUser);
router.get("/blocked/list", protect, getBlockedUsers);
router.put("/settings", protect, updateSettings);
router.post("/follow", protect, followUser);
router.post("/unfollow", protect, unfollowUser);
router.post("/change-password", protect, changePassword);

module.exports = router;
