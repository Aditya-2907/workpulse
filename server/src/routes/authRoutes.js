const express = require("express");
const { managementLogin } = require("../controllers/authController");

const router = express.Router();

router.post("/management/login", managementLogin);

module.exports = router;