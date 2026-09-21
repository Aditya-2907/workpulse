const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { getAlerts } = require("../controllers/alertController");
const router = express.Router();
router.get("/", authenticate, allowRoles("ADMIN", "SUPER_ADMIN"), getAlerts);
module.exports = router;
