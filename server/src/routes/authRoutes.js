const express = require("express");
const {
    managementLogin,
    changeManagementPassword,
} = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/management/login", managementLogin);

router.patch(
    "/management/change-password",
    authenticate,
    allowRoles("ADMIN", "SUPER_ADMIN"),
    changeManagementPassword
);

module.exports = router;
