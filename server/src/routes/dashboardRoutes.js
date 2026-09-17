const express = require("express");

const {
    getSuperAdminDashboard,
    getAdminDashboard,
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

router.get(
    "/admin",
    authenticate,
    allowRoles("ADMIN"),
    getAdminDashboard
);

module.exports = router;