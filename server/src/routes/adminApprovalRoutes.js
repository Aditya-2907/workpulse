const express = require("express");

const {
    requestAdminCreation,
    getAdminApprovalRequests,
    reviewAdminApprovalRequest,
} = require("../controllers/adminApprovalController");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
    "/request",
    authenticate,
    allowRoles("ADMIN"),
    requestAdminCreation
);

router.get(
    "/",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    getAdminApprovalRequests
);

router.patch(
    "/:id/review",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    reviewAdminApprovalRequest
);

module.exports = router;