const express = require("express");

const {
    createBranch,
    getBranches,
    getBranchById,
    updateBranch,
    updateBranchStatus,
} = require("../controllers/branchController");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(
    authenticate,
    allowRoles("SUPER_ADMIN")
);

router.post("/", createBranch);

router.get("/", getBranches);

router.get("/:id", getBranchById);

router.put("/:id", updateBranch);

router.patch("/:id/status", updateBranchStatus);

module.exports = router;