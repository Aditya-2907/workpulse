const express = require("express");

const {
    attendanceLogin,
    validateLocation,
    checkIn,
    checkOut,
} = require("../controllers/attendanceController");

const {
    authenticateAttendance,
} = require("../middleware/attendanceAuthMiddleware");

const {
    uploadAttendancePhoto,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post(
    "/login",
    attendanceLogin
);

router.post(
    "/validate-location",
    authenticateAttendance,
    validateLocation
);

router.post(
    "/check-in",
    authenticateAttendance,
    uploadAttendancePhoto.single("photo"),
    checkIn
);

router.post(
    "/check-out",
    authenticateAttendance,
    uploadAttendancePhoto.single("photo"),
    checkOut
);

module.exports = router;