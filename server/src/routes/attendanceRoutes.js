const express = require("express");

const {
    attendanceLogin,
} = require("../controllers/attendanceController");

const router = express.Router();

router.post("/login", attendanceLogin);

module.exports = router;