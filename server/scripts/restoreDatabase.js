require("dotenv").config({ quiet: true });
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const backupFile = process.argv[2] ? path.resolve(process.argv[2]) : null;
const execute = process.argv.includes("--execute") && process.argv.includes("--confirm-restore");
if (!backupFile || !fs.existsSync(backupFile) || path.extname(backupFile).toLowerCase() !== ".sql") { console.error("FAIL: supply an existing .sql backup path"); process.exit(1); }
if (!execute) { console.log("DRY RUN: backup file exists and no restore will occur. Use --execute --confirm-restore only against an approved target."); process.exit(0); }
if (process.env.NODE_ENV !== "production" && process.env.ALLOW_NON_PRODUCTION_RESTORE !== "true") { console.error("FAIL: non-production restore is blocked unless ALLOW_NON_PRODUCTION_RESTORE=true is explicitly set."); process.exit(1); }
const result = spawnSync("mysql", ["--host", process.env.DB_HOST, "--port", process.env.DB_PORT || "3306", "--user", process.env.DB_USER, process.env.DB_NAME], { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || "" }, input: fs.readFileSync(backupFile), stdio: ["pipe", "inherit", "inherit"], shell: process.platform === "win32" });
if (result.status !== 0) { console.error("FAIL: restore command failed"); process.exit(1); }
console.log("PASS: restore command completed. Run schema and application smoke checks before accepting the environment.");
