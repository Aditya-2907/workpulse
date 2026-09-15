const express = require("express");

const {
    getSuperAdminDashboard,
} = require("../controllers/dashboardController");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/super-admin",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    getSuperAdminDashboard
);

module.exports = router;