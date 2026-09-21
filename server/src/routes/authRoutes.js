const express = require("express");
const {
    managementLogin,
    changeManagementPassword,
    requestPasswordReset,
    resetPassword,
    forceManagementPasswordChange,
    getManagementProfile,
    updateManagementProfile,
} = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { managementLoginLimiter, passwordResetLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/management/login", managementLoginLimiter, managementLogin);
router.post("/management/forgot-password", passwordResetLimiter, requestPasswordReset);
router.post("/management/reset-password", passwordResetLimiter, resetPassword);
router.patch("/management/force-password-change", authenticate, allowRoles("ADMIN"), forceManagementPasswordChange);

router.get("/management/profile", authenticate, allowRoles("ADMIN", "SUPER_ADMIN"), getManagementProfile);
router.patch("/management/profile", authenticate, allowRoles("ADMIN", "SUPER_ADMIN"), updateManagementProfile);

router.patch(
    "/management/change-password",
    authenticate,
    allowRoles("ADMIN", "SUPER_ADMIN"),
    changeManagementPassword
);

module.exports = router;
