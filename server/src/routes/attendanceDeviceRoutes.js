const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { getDevices, createDevice, revokeDevice } = require("../controllers/attendanceDeviceController");
const router = express.Router();
router.use(authenticate, allowRoles("SUPER_ADMIN"));
router.get("/", getDevices); router.post("/", createDevice); router.patch("/:id/revoke", revokeDevice);
module.exports = router;
