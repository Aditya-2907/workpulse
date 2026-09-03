const express = require("express");

const {
    createAdmin,
    getAdmins,
    updateAdminStatus,
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

router.patch("/:id/status", updateAdminStatus);

module.exports = router;