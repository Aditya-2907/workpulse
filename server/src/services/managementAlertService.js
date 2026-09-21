const db = require("../config/db");

const getAlertSettings = async () => {
    const [[settings]] = await db.query(
        `SELECT attendance_alert_threshold AS attendanceAlertThreshold,
                missing_checkout_grace_minutes AS missingCheckoutGraceMinutes
         FROM organization_settings WHERE id = 1`
    );
    return {
        attendanceAlertThreshold: Number(settings?.attendanceAlertThreshold ?? 70),
        missingCheckoutGraceMinutes: Number(settings?.missingCheckoutGraceMinutes ?? 30),
    };
};

const scopeClause = (branchId) => branchId ? { sql: " AND u.branch_id = ?", params: [branchId] } : { sql: "", params: [] };

const getBelowThresholdEmployees = async (branchId = null) => {
    const settings = await getAlertSettings();
    const scope = scopeClause(branchId);
    const [rows] = await db.query(
        `WITH RECURSIVE calendar AS (
            SELECT DATE_FORMAT(CURDATE(), '%Y-%m-01') AS work_day
            UNION ALL SELECT DATE_ADD(work_day, INTERVAL 1 DAY) FROM calendar WHERE work_day < CURDATE()
        ), employee_days AS (
            SELECT u.id AS user_id, u.full_name, u.employee_code, u.branch_id, b.branch_name, d.department_name,
                   calendar.work_day,
                   CASE WHEN h.id IS NULL AND w.id IS NULL AND l.id IS NULL THEN 1 ELSE 0 END AS eligible_day,
                   CASE WHEN ar.id IS NOT NULL AND ar.check_in_time IS NOT NULL THEN 1 ELSE 0 END AS present_day
            FROM users u
            INNER JOIN branches b ON b.id = u.branch_id
            LEFT JOIN departments d ON d.id = u.department_id
            CROSS JOIN calendar
            LEFT JOIN holidays h ON h.holiday_date = calendar.work_day
            LEFT JOIN branch_weekly_offs w ON w.branch_id = u.branch_id AND w.weekday = UPPER(DAYNAME(calendar.work_day))
            LEFT JOIN leaves l ON l.user_id = u.id AND l.status = 'APPROVED' AND calendar.work_day BETWEEN l.from_date AND l.to_date
            LEFT JOIN attendance_records ar ON ar.user_id = u.id AND ar.attendance_date = calendar.work_day
            WHERE u.role = 'EMPLOYEE' AND u.account_status = 'ACTIVE' ${scope.sql}
        )
        SELECT user_id AS userId, full_name AS fullName, employee_code AS employeeCode, branch_id AS branchId,
               branch_name AS branchName, department_name AS departmentName,
               SUM(eligible_day) AS eligibleDays,
               SUM(CASE WHEN eligible_day = 1 THEN present_day ELSE 0 END) AS presentDays,
               ROUND(100 * SUM(CASE WHEN eligible_day = 1 THEN present_day ELSE 0 END) / NULLIF(SUM(eligible_day), 0), 2) AS attendanceRate
        FROM employee_days
        GROUP BY user_id, full_name, employee_code, branch_id, branch_name, department_name
        HAVING eligibleDays > 0 AND attendanceRate < ?
        ORDER BY attendanceRate ASC, full_name ASC`,
        [...scope.params, settings.attendanceAlertThreshold]
    );
    return { threshold: settings.attendanceAlertThreshold, periodStart: null, periodEnd: null, employees: rows.map((row) => ({ ...row, attendanceRate: Number(row.attendanceRate), eligibleDays: Number(row.eligibleDays), presentDays: Number(row.presentDays) })) };
};

const getMissingCheckoutRecords = async (branchId = null) => {
    const settings = await getAlertSettings();
    const scope = scopeClause(branchId);
    const [rows] = await db.query(
        `SELECT ar.id AS attendanceRecordId, ar.attendance_date AS attendanceDate, ar.check_in_time AS checkInTime,
                u.id AS userId, u.full_name AS fullName, u.employee_code AS employeeCode,
                b.id AS branchId, b.branch_name AS branchName, d.department_name AS departmentName,
                u.duty_end_time AS dutyEndTime
         FROM attendance_records ar
         INNER JOIN users u ON u.id = ar.user_id
         INNER JOIN branches b ON b.id = ar.branch_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE ar.check_in_time IS NOT NULL AND ar.check_out_time IS NULL
           AND u.role IN ('EMPLOYEE', 'ADMIN') ${scope.sql}
           AND (ar.attendance_date < CURDATE() OR (ar.attendance_date = CURDATE() AND u.duty_end_time IS NOT NULL AND NOW() >= DATE_ADD(CONCAT(CURDATE(), ' ', u.duty_end_time), INTERVAL ? MINUTE)))
         ORDER BY ar.attendance_date ASC, ar.check_in_time ASC`,
        [...scope.params, settings.missingCheckoutGraceMinutes]
    );
    return { graceMinutes: settings.missingCheckoutGraceMinutes, records: rows };
};

const getManagementAlerts = async (branchId = null, isSuperAdmin = false) => {
    const [belowThreshold, missingCheckout] = await Promise.all([
        getBelowThresholdEmployees(branchId),
        getMissingCheckoutRecords(branchId),
    ]);
    let pendingAdminRequests = 0;
    if (isSuperAdmin) {
        const [[result]] = await db.query("SELECT COUNT(*) AS count FROM admin_approval_requests WHERE status = 'PENDING'");
        pendingAdminRequests = Number(result.count || 0);
    }
    return { belowThreshold, missingCheckout, pendingAdminRequests, totalCount: belowThreshold.employees.length + missingCheckout.records.length + pendingAdminRequests };
};

module.exports = { getBelowThresholdEmployees, getMissingCheckoutRecords, getManagementAlerts };
