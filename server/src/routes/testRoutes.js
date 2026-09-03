const express = require("express");

const {
    getMyProfile,
    superAdminOnly,
    managementOnly,
} = require("../controllers/testController");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/me",
    authenticate,
    getMyProfile
);

router.get(
    "/management",
    authenticate,
    allowRoles("ADMIN", "SUPER_ADMIN"),
    managementOnly
);

router.get(
    "/super-admin",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    superAdminOnly
);

module.exports = router;