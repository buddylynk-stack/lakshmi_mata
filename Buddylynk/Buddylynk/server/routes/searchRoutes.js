const express = require("express");
const { search } = require("../controllers/searchController");
const { getUserSuggestions } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/suggestions", protect, getUserSuggestions);
router.get("/", search);

module.exports = router;
