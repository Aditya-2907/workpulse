const db = require("../config/db");

const getSuperAdminDashboard = async (req, res) => {
    try {
        const [
            [branchResult],
            [adminResult],
            [employeeResult],
            [presentResult],
            [lateResult],
            [leaveResult],
            [totalActiveEmployeeResult],
        ] = await Promise.all([
            db.query(`
                SELECT COUNT(*) AS total
                FROM branches
                WHERE status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'ADMIN'
                AND account_status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'EMPLOYEE'
                AND account_status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(DISTINCT user_id) AS total
                FROM attendance_records
                WHERE attendance_date = CURDATE()
                AND check_in_time IS NOT NULL
            `),

            db.query(`
                SELECT COUNT(DISTINCT user_id) AS total
                FROM attendance_records
                WHERE attendance_date = CURDATE()
                AND is_late = 1
            `),

            db.query(`
                SELECT COUNT(DISTINCT user_id) AS total
                FROM leaves
                WHERE CURDATE() BETWEEN from_date AND to_date
                AND status = 'APPROVED'
            `),

            db.query(`
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'EMPLOYEE'
                AND account_status = 'ACTIVE'
            `),
        ]);

        const totalBranches = Number(branchResult[0]?.total || 0);
        const totalAdmins = Number(adminResult[0]?.total || 0);
        const totalEmployees = Number(employeeResult[0]?.total || 0);
        const presentToday = Number(presentResult[0]?.total || 0);
        const lateToday = Number(lateResult[0]?.total || 0);
        const leaveToday = Number(leaveResult[0]?.total || 0);
        const totalActiveEmployees = Number(
            totalActiveEmployeeResult[0]?.total || 0
        );

        const absentToday = Math.max(
            totalActiveEmployees - presentToday - leaveToday,
            0
        );

        return res.status(200).json({
            success: true,
            data: {
                totals: {
                    branches: totalBranches,
                    admins: totalAdmins,
                    employees: totalEmployees,
                    presentToday,
                },

                attendance: {
                    present: presentToday,
                    late: lateToday,
                    leave: leaveToday,
                    absent: absentToday,
                },
            },
        });
    } catch (error) {
        console.error("Super Admin dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard data",
        });
    }
};

module.exports = {
    getSuperAdminDashboard,
};