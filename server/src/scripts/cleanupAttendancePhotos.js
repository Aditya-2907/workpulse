const db = require("../config/db");

const {
    deleteAttendancePhoto,
} = require("../services/attendancePhotoService");

const RETENTION_DAYS = 90;
const EXECUTE_MODE = process.argv.includes("--execute");

const isSuccessfulDeleteResult = (result) => {
    return (
        result?.result === "ok" ||
        result?.result === "not found"
    );
};

const cleanupPhoto = async ({
    recordId,
    publicId,
    photoType,
}) => {
    const isCheckIn = photoType === "check_in";

    const pathColumn = isCheckIn
        ? "check_in_photo_path"
        : "check_out_photo_path";

    const publicIdColumn = isCheckIn
        ? "check_in_photo_public_id"
        : "check_out_photo_public_id";

    const deletedAtColumn = isCheckIn
        ? "check_in_photo_deleted_at"
        : "check_out_photo_deleted_at";

    try {
        const result =
            await deleteAttendancePhoto(publicId);

        if (!isSuccessfulDeleteResult(result)) {
            console.error(
                `Cloudinary did not confirm deletion for ${photoType} photo`,
                {
                    recordId,
                    publicId,
                    result,
                }
            );

            return false;
        }

        const [updateResult] = await db.query(
            `UPDATE attendance_records
     SET
        ${pathColumn} = NULL,
        ${publicIdColumn} = NULL,
        ${deletedAtColumn} = NOW()
     WHERE id = ?
       AND ${publicIdColumn} = ?
       AND ${deletedAtColumn} IS NULL`,
            [
                recordId,
                publicId,
            ]
        );

        if (updateResult.affectedRows !== 1) {
            console.error(
                `Database cleanup state changed unexpectedly for ${photoType} photo`,
                {
                    recordId,
                    affectedRows: updateResult.affectedRows,
                }
            );

            return false;
        }

        console.log(
            `Deleted ${photoType} photo for attendance record ${recordId}`
        );

        return true;
    } catch (error) {
        console.error(
            `Failed to delete ${photoType} photo for attendance record ${recordId}:`,
            error.message
        );

        return false;
    }
};

const runCleanup = async () => {
    let deletedPhotos = 0;
    let failedPhotos = 0;

    try {
        console.log(
            `Attendance photo retention cleanup (${RETENTION_DAYS} days)`
        );

        console.log(
            EXECUTE_MODE
                ? "MODE: EXECUTE"
                : "MODE: DRY RUN"
        );

        const [rows] = await db.query(
            `SELECT
                id,
                attendance_date,
                check_in_photo_public_id,
                check_in_photo_deleted_at,
                check_out_photo_public_id,
                check_out_photo_deleted_at
             FROM attendance_records
             WHERE attendance_date < DATE_SUB(CURDATE(), INTERVAL ? DAY)
               AND (
                    (
                        check_in_photo_public_id IS NOT NULL
                        AND check_in_photo_deleted_at IS NULL
                    )
                    OR
                    (
                        check_out_photo_public_id IS NOT NULL
                        AND check_out_photo_deleted_at IS NULL
                    )
               )
             ORDER BY attendance_date ASC, id ASC`,
            [RETENTION_DAYS]
        );

        if (rows.length === 0) {
            console.log(
                "No attendance photos are currently eligible for deletion."
            );
            return;
        }

        console.log(
            `${rows.length} attendance record(s) contain photos eligible for deletion.`
        );

        for (const row of rows) {
            const checkInEligible =
                Boolean(row.check_in_photo_public_id) &&
                !row.check_in_photo_deleted_at;

            const checkOutEligible =
                Boolean(row.check_out_photo_public_id) &&
                !row.check_out_photo_deleted_at;

            if (!EXECUTE_MODE) {
                console.log({
                    attendanceRecordId: row.id,
                    attendanceDate: row.attendance_date,
                    checkInPhotoEligible: checkInEligible,
                    checkOutPhotoEligible: checkOutEligible,
                });

                continue;
            }

            if (checkInEligible) {
                const success = await cleanupPhoto({
                    recordId: row.id,
                    publicId:
                        row.check_in_photo_public_id,
                    photoType: "check_in",
                });

                if (success) {
                    deletedPhotos += 1;
                } else {
                    failedPhotos += 1;
                }
            }

            if (checkOutEligible) {
                const success = await cleanupPhoto({
                    recordId: row.id,
                    publicId:
                        row.check_out_photo_public_id,
                    photoType: "check_out",
                });

                if (success) {
                    deletedPhotos += 1;
                } else {
                    failedPhotos += 1;
                }
            }
        }

        if (!EXECUTE_MODE) {
            console.log(
                "DRY RUN ONLY: No Cloudinary assets or database records were changed."
            );

            return;
        }

        console.log("Attendance photo cleanup finished.");
        console.log(`Deleted photos: ${deletedPhotos}`);
        console.log(`Failed photos: ${failedPhotos}`);

        if (failedPhotos > 0) {
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(
            "Attendance photo retention cleanup failed:",
            error
        );

        process.exitCode = 1;
    } finally {
        await db.end();
    }
};

runCleanup();