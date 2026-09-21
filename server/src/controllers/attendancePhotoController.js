const db = require("../config/db");
const { getAttendancePhotoDeliveryUrl } = require("../services/attendancePhotoService");

const getAuthorizedAttendancePhoto = async (req, res) => {
    try {
        const recordId = Number.parseInt(req.params.id, 10);
        const kind = String(req.params.kind || "").toLowerCase();
        if (!Number.isInteger(recordId) || !["check-in", "check-out"].includes(kind)) return res.status(400).json({ success: false, message: "Invalid photo request." });
        const scoped = req.user.role === "ADMIN";
        const [[record]] = await db.query(
            `SELECT ar.check_in_photo_path AS checkInPath, ar.check_in_photo_public_id AS checkInPublicId,
                    ar.check_out_photo_path AS checkOutPath, ar.check_out_photo_public_id AS checkOutPublicId
             FROM attendance_records ar WHERE ar.id = ? ${scoped ? "AND ar.branch_id = ?" : ""} LIMIT 1`,
            scoped ? [recordId, req.user.branchId] : [recordId]
        );
        if (!record) return res.status(404).json({ success: false, message: "Attendance photo not found." });
        const publicId = kind === "check-in" ? record.checkInPublicId : record.checkOutPublicId;
        const storedPath = kind === "check-in" ? record.checkInPath : record.checkOutPath;
        const url = getAttendancePhotoDeliveryUrl(publicId, storedPath);
        if (!url) return res.status(404).json({ success: false, message: "Attendance photo unavailable." });
        const upstream = await fetch(url);
        if (!upstream.ok) return res.status(404).json({ success: false, message: "Attendance photo unavailable." });
        const contentType = upstream.headers.get("content-type") || "image/jpeg";
        if (!contentType.startsWith("image/")) return res.status(502).json({ success: false, message: "Invalid attendance photo response." });
        res.set({ "Content-Type": contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
        return res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (_error) {
        return res.status(500).json({ success: false, message: "Unable to retrieve attendance photo." });
    }
};

module.exports = { getAuthorizedAttendancePhoto };
