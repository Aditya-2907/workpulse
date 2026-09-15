const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const branchRoutes = require("./routes/branchRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminApprovalRoutes = require("./routes/adminApprovalRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const holidayRoutes = require("./routes/holidayRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

app.use(cors({
    exposedHeaders: ["Content-Disposition"],
}));
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "WorkPulse API is running",
    });
});

app.use("/api/auth", authRoutes);

app.use("/api/test", testRoutes);

app.use("/api/branches", branchRoutes);

app.use("/api/departments", departmentRoutes);

app.use("/api/admins", adminRoutes);

app.use("/api/employees", employeeRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/admin-approvals", adminApprovalRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/leaves", leaveRoutes);

app.use("/api/holidays", holidayRoutes);

app.use("/api/reports", reportRoutes);

module.exports = app;
