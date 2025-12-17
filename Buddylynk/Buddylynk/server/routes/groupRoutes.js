const express = require("express");
const { 
    createGroup, 
    getAllGroups,
    getOnlyGroups,
    getOnlyChannels,
    getGroupById, 
    getGroupByInvite, 
    joinByInvite, 
    updateGroup, 
    joinGroup, 
    leaveGroup, 
    deleteGroup, 
    addPostToGroup, 
    editGroupPost, 
    deleteGroupPost, 
    regenerateInviteLink,
    addAdmin,
    removeAdmin,
    likeGroupPost,
    voteOnPoll,
    addCommentToGroupPost,
    deleteCommentFromGroupPost,
    editCommentInGroupPost,
    getGroupMembers,
    removeMember,
    unbanUser,
    getBannedUsers
} = require("../controllers/groupController");
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/", protect, getAllGroups); // Now requires auth to filter private channels
router.get("/groups-only", protect, getOnlyGroups); // Get only groups (not channels)
router.get("/channels-only", protect, getOnlyChannels); // Get only channels (not groups)
router.post("/", protect, upload.single("coverImage"), createGroup);

// Invite routes (for private channels) - must be before /:id routes
router.get("/invite/:inviteCode", optionalProtect, getGroupByInvite);
router.post("/invite/:inviteCode/join", protect, joinByInvite);

router.get("/:id", optionalProtect, getGroupById);
router.put("/:id", protect, upload.single("coverImage"), updateGroup);
router.post("/:id/join", protect, joinGroup);
router.post("/:id/leave", protect, leaveGroup);
router.delete("/:id", protect, deleteGroup);
router.post("/:id/regenerate-invite", protect, regenerateInviteLink); // Regenerate invite link

// Members management
router.get("/:id/members", protect, getGroupMembers); // Get members list
router.delete("/:id/members", protect, removeMember); // Remove/kick member (also bans)

// Banned users management
router.get("/:id/banned", protect, getBannedUsers); // Get banned users list
router.delete("/:id/banned", protect, unbanUser); // Unban a user

// Admin management
router.post("/:id/admins", protect, addAdmin); // Add admin
router.delete("/:id/admins", protect, removeAdmin); // Remove admin

// Posts
router.post("/:id/posts", protect, upload.array("media", 20), addPostToGroup); // Allow up to 20 files
router.put("/:id/posts/:postId", protect, editGroupPost);
router.delete("/:id/posts/:postId", protect, deleteGroupPost);
router.post("/:id/posts/:postId/like", protect, likeGroupPost); // Like/unlike post
router.post("/:id/posts/:postId/vote", protect, voteOnPoll); // Vote on poll

// Comments
router.post("/:id/posts/:postId/comments", protect, addCommentToGroupPost); // Add comment
router.put("/:id/posts/:postId/comments/:commentId", protect, editCommentInGroupPost); // Edit comment
router.delete("/:id/posts/:postId/comments/:commentId", protect, deleteCommentFromGroupPost); // Delete comment

module.exports = router;
