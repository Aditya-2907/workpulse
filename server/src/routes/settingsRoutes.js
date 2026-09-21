const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { getSettings, updateSettings } = require("../controllers/settingsController");

const router = express.Router();
router.use(authenticate, allowRoles("SUPER_ADMIN"));
router.get("/", getSettings);
router.put("/", updateSettings);
module.exports = router;
