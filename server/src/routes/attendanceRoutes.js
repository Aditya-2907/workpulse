const express = require("express");

const {
    attendanceLogin,
    validateLocation,
} = require("../controllers/attendanceController");

const {
    authenticateAttendance,
} = require("../middleware/attendanceAuthMiddleware");

const router = express.Router();

router.post("/login", attendanceLogin);

router.post(
    "/validate-location",
    authenticateAttendance,
    validateLocation
);

module.exports = router;