const express = require("express");

const {
    createLeave,
    getLeaves,
    cancelLeave,
} = require("../controllers/leaveController");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(
    authenticate,
    allowRoles("ADMIN", "SUPER_ADMIN")
);

router.get("/", getLeaves);

router.post("/", createLeave);

router.patch("/:id/cancel", cancelLeave);

module.exports = router;