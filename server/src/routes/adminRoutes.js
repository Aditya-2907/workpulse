const express = require("express");

const {
    createAdmin,
    getAdmins,
    getAdminById,
    updateAdmin,
    updateAdminStatus,
    resetAdminPassword,
} = require("../controllers/adminController");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(
    authenticate,
    allowRoles("SUPER_ADMIN")
);

router.post("/", createAdmin);

router.get("/", getAdmins);

router.get("/:id", getAdminById);

router.put("/:id", updateAdmin);

router.patch("/:id/status", updateAdminStatus);

router.patch("/:id/reset-password", resetAdminPassword);

module.exports = router;
