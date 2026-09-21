const db = require("../config/db");
const { writeAuditLog } = require("../services/auditService");

const toMysqlDateTime = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
    return value.replace("T", " ");
};

const correctAttendance = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const recordId = Number.parseInt(req.params.id, 10);
        const checkInTime = toMysqlDateTime(req.body.checkInTime);
        const checkOutTime = req.body.checkOutTime ? toMysqlDateTime(req.body.checkOutTime) : null;
        const reason = String(req.body.reason || "").trim();
        if (!Number.isInteger(recordId) || !checkInTime || !reason || reason.length > 500 || (req.body.checkOutTime && !checkOutTime)) return res.status(400).json({ success: false, message: "A record, valid check-in/check-out values, and a correction reason are required." });
        if (checkOutTime && checkOutTime <= checkInTime) return res.status(400).json({ success: false, message: "Check-out must be after check-in." });
        await connection.beginTransaction();
        const [[record]] = await connection.query(
            `SELECT ar.*, u.duty_start_time AS dutyStartTime, u.duty_end_time AS dutyEndTime
             FROM attendance_records ar INNER JOIN users u ON u.id = ar.user_id
             WHERE ar.id = ? FOR UPDATE`, [recordId]
        );
        if (!record) { await connection.rollback(); return res.status(404).json({ success: false, message: "Attendance record not found." }); }
        if (String(record.attendance_date).slice(0, 10) !== checkInTime.slice(0, 10) || (checkOutTime && String(record.attendance_date).slice(0, 10) !== checkOutTime.slice(0, 10))) { await connection.rollback(); return res.status(400).json({ success: false, message: "Corrected timestamps must remain on the attendance date." }); }
        const [[calculation]] = await connection.query(
            `SELECT
                TIMESTAMPDIFF(MINUTE, ?, ?) AS workedMinutes,
                TIMESTAMPDIFF(MINUTE, CONCAT(?, ' ', ?), CONCAT(?, ' ', ?)) AS requiredMinutes,
                CASE WHEN ? > DATE_ADD(CONCAT(?, ' ', ?), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END AS isLate,
                CASE WHEN ? IS NOT NULL AND ? < CONCAT(?, ' ', ?) THEN 1 ELSE 0 END AS isEarlyDeparture`,
            [checkInTime, checkOutTime || checkInTime, record.attendance_date, record.dutyStartTime, record.attendance_date, record.dutyEndTime, checkInTime, record.attendance_date, record.dutyStartTime, checkOutTime, checkOutTime, record.attendance_date, record.dutyEndTime]
        );
        const requiredMinutes = Math.max(0, Number(calculation.requiredMinutes || record.required_minutes || 0));
        const workedMinutes = checkOutTime ? Math.max(0, Number(calculation.workedMinutes || 0)) : null;
        const attendancePercentage = workedMinutes === null ? null : Math.round((requiredMinutes ? (workedMinutes / requiredMinutes) * 100 : 0) * 100) / 100;
        const attendanceStatus = workedMinutes === null ? "PENDING" : attendancePercentage >= 80 ? "FULL_DAY" : attendancePercentage >= 40 ? "PARTIAL_DAY" : "INSUFFICIENT_ATTENDANCE";
        const originalData = { checkInTime: record.check_in_time, checkOutTime: record.check_out_time, workedMinutes: record.worked_minutes, attendancePercentage: record.attendance_percentage, isLate: Boolean(record.is_late), isEarlyDeparture: Boolean(record.is_early_departure), attendanceStatus: record.attendance_status };
        const correctedData = { checkInTime, checkOutTime, workedMinutes, attendancePercentage, isLate: Boolean(calculation.isLate), isEarlyDeparture: Boolean(calculation.isEarlyDeparture), attendanceStatus };
        await connection.query(
            `UPDATE attendance_records SET check_in_time = ?, check_out_time = ?, required_minutes = ?, worked_minutes = ?, attendance_percentage = ?, is_late = ?, is_early_departure = ?, attendance_status = ? WHERE id = ?`,
            [checkInTime, checkOutTime, requiredMinutes, workedMinutes, attendancePercentage, Boolean(calculation.isLate), Boolean(calculation.isEarlyDeparture), attendanceStatus, recordId]
        );
        const [correction] = await connection.query("INSERT INTO attendance_corrections (attendance_record_id, corrected_by, reason, original_data, corrected_data) VALUES (?, ?, ?, ?, ?)", [recordId, req.user.id, reason, JSON.stringify(originalData), JSON.stringify(correctedData)]);
        await writeAuditLog(connection, { actorId: req.user.id, action: "ATTENDANCE_MANUALLY_CORRECTED", entityType: "ATTENDANCE_RECORD", entityId: recordId, oldData: originalData, newData: { ...correctedData, correctionId: correction.insertId, reason }, req });
        await connection.commit();
        return res.json({ success: true, message: "Attendance corrected and recalculated.", attendance: correctedData });
    } catch (_error) {
        await connection.rollback();
        return res.status(500).json({ success: false, message: "Unable to correct attendance." });
    } finally { connection.release(); }
};

module.exports = { correctAttendance };
