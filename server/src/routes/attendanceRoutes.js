const express = require("express");

const {
    attendanceLogin,
    validateLocation,
    checkIn,
    checkOut,
    getManagementAttendance,
} = require("../controllers/attendanceController");

const {
    authenticateAttendance,
} = require("../middleware/attendanceAuthMiddleware");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const {
    uploadAttendancePhoto,
} = require("../middleware/uploadMiddleware");
const { attendanceLoginLimiter } = require("../middleware/rateLimiters");
const { correctAttendance } = require("../controllers/attendanceCorrectionController");
const { getAuthorizedAttendancePhoto } = require("../controllers/attendancePhotoController");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Attendance Kiosk Routes
|--------------------------------------------------------------------------
| Employee/Admin attendance flow uses the short-lived attendance token.
*/

router.post(
    "/login",
    attendanceLoginLimiter,
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

/*
|--------------------------------------------------------------------------
| Management Attendance Routes
|--------------------------------------------------------------------------
| ADMIN       -> only own branch
| SUPER_ADMIN -> all branches / selected branch
*/

router.get(
    "/management",
    authenticate,
    allowRoles("ADMIN", "SUPER_ADMIN"),
    getManagementAttendance
);

router.patch(
    "/management/:id/correction",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    correctAttendance
);

router.get(
    "/management/:id/photo/:kind",
    authenticate,
    allowRoles("ADMIN", "SUPER_ADMIN"),
    getAuthorizedAttendancePhoto
);

module.exports = router;
