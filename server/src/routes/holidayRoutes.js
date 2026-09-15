const express = require("express");

const {
    getHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
} = require("../controllers/holidayController");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ======================================================
// SUPER ADMIN ONLY MIDDLEWARE
// ======================================================

const superAdminOnly = (req, res, next) => {
    if (
        !req.user ||
        req.user.role !== "SUPER_ADMIN"
    ) {
        return res.status(403).json({
            success: false,
            message: "Super Admin access required",
        });
    }

    next();
};

// ======================================================
// APPLY AUTH + ROLE PROTECTION
// ======================================================

router.use(
    authenticate,
    superAdminOnly
);

// ======================================================
// HOLIDAY ROUTES
// ======================================================

router.get("/", getHolidays);

router.post("/", createHoliday);

router.patch("/:id", updateHoliday);

router.delete("/:id", deleteHoliday);

module.exports = router;