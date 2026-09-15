const express = require("express");

const {
    requireReportDates,
    getAttendanceReport,
    exportAttendanceReportExcel,
    exportAttendanceReportPdf,
} = require("../controllers/reportController");

const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(
    authenticate,
    allowRoles("SUPER_ADMIN", "ADMIN"),
    requireReportDates
);

router.get("/attendance", getAttendanceReport);
router.get("/attendance/excel", exportAttendanceReportExcel);
router.get("/attendance/pdf", exportAttendanceReportPdf);

module.exports = router;
