const router = require("express").Router();
const { getSetupStatus, completeSetup } = require("../controllers/setupController");
const { setupLimiter } = require("../middleware/rateLimiters");
router.get("/status", getSetupStatus);
router.post("/complete", setupLimiter, completeSetup);
module.exports = router;
