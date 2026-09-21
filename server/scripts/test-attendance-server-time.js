require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    console.log(`PASS: ${message}`);
};

const run = async () => {
    const source = fs.readFileSync(
        path.join(__dirname, "../src/controllers/attendanceController.js"),
        "utf8"
    );
    const checkInSource = source.slice(source.indexOf("const checkIn"), source.indexOf("const checkOut"));
    const checkOutSource = source.slice(source.indexOf("const checkOut"), source.indexOf("// Start Aditya - Management Attendance"));

    assert(/const\s*\{\s*latitude,\s*longitude,\s*remarks\s*,?\s*\}\s*=\s*req\.body/.test(checkInSource), "check-in accepts only location/remarks request fields");
    assert(/const\s*\{\s*latitude,\s*longitude,\s*remarks\s*,?\s*\}\s*=\s*req\.body/.test(checkOutSource), "check-out accepts only location/remarks request fields");
    assert(!/req\.body\.(attendance_date|attendanceDate|check_in_time|checkInTime|check_out_time|checkOutTime|current_time|currentTime|client_timestamp|clientTimestamp)/.test(`${checkInSource}${checkOutSource}`), "client timestamps cannot control attendance recording");
    assert(/attendance_date = CURDATE\(\)/.test(checkInSource) && /VALUES \(\?, \?, CURDATE\(\), NOW\(\)/.test(checkInSource), "check-in date and timestamp come from MySQL");
    assert(/TIMESTAMPDIFF[\s\S]*NOW\(\)/.test(checkOutSource) && /check_out_time = NOW\(\)/.test(checkOutSource), "check-out duration and timestamp come from MySQL");
    assert(/SET time_zone = '\+05:30'/.test(fs.readFileSync(path.join(__dirname, "../src/config/db.js"), "utf8")), "database sessions are pinned to IST");

    const [[timezone]] = await db.query("SELECT @@session.time_zone AS sessionTimeZone, DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS currentDate, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS currentDateTime");
    assert(timezone.sessionTimeZone === "+05:30", "live database session uses IST for CURDATE/NOW");
    console.log(JSON.stringify({ currentDate: timezone.currentDate, currentDateTime: timezone.currentDateTime }));
    await db.end();
};

run().catch(async (error) => {
    console.error(`FAIL: ${error.message}`);
    try { await db.end(); } catch {}
    process.exitCode = 1;
});
