const fs = require("fs");
const path = require("path");

const read = (...segments) => fs.readFileSync(path.join(__dirname, "..", ...segments), "utf8");
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    console.log(`PASS: ${message}`);
};

const run = () => {
    const schema = read("..", "database", "schema.sql");
    const schemaCompletionMigration = read("scripts", "apply-schema-completion-migration.js");
    [
        "branch_weekly_offs",
        "password_reset_tokens",
        "check_in_photo_public_id",
        "check_out_photo_public_id",
        "attendance_corrections",
        "attendance_devices",
        "organization_settings",
    ].forEach((required) => assert(schema.includes(required), `fresh schema includes ${required}`));
    assert(!/^\s*USE\s+/im.test(schema), "fresh schema does not select a hard-coded database");
    assert(schemaCompletionMigration.includes("CREATE TABLE IF NOT EXISTS branch_weekly_offs") && schemaCompletionMigration.includes("addColumnIfMissing"), "existing installations have an idempotent schema-completion helper");

    const upload = read("src", "middleware", "uploadMiddleware.js");
    const attendance = read("src", "controllers", "attendanceController.js");
    const photoService = read("src", "services", "attendancePhotoService.js");
    assert(upload.includes("multer.memoryStorage()") && !upload.includes("diskStorage"), "attendance uploads are memory-only");
    assert(attendance.includes("req.file.buffer") && !attendance.includes("req.file.path"), "attendance controller never relies on a local photo path");
    assert(attendance.includes("checkInPhotoAvailable") && !attendance.includes("check_in_photo_path AS checkInPhotoPath"), "management attendance rows expose photo availability instead of storage URLs");
    assert(photoService.includes("upload_stream"), "photo service streams request data to authenticated storage");

    const app = read("src", "app.js");
    assert(app.includes("error instanceof multer.MulterError") && app.includes("LIMIT_FILE_SIZE"), "upload failures return safe client responses");

    const clientApp = read("..", "client", "src", "App.jsx");
    const clientApi = read("..", "client", "src", "services", "api.js");
    assert(clientApp.includes('path="/forgot-password"') && clientApp.includes('path="/reset-password"'), "public password-reset routes are mounted");
    assert(clientApi.includes("/auth/management/forgot-password") && clientApi.includes("/auth/management/reset-password"), "password-reset client calls use management APIs");
    console.log("PASS: deployment readiness static contract checks completed");
};

try {
    run();
} catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
}
