require("dotenv").config({ quiet: true });
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, "..", "backups"));
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `${process.env.DB_NAME || "workpulse"}-${timestamp}.sql`;
const target = path.join(backupDir, filename);
const required = ["DB_HOST", "DB_USER", "DB_NAME"].filter((name) => !process.env[name]);
if (required.length) { console.error(`FAIL: missing ${required.join(", ")}`); process.exit(1); }
const probe = spawnSync("mysqldump", ["--version"], { shell: process.platform === "win32" });
if (probe.error || probe.status !== 0) { console.error("FAIL: mysqldump is unavailable. Install a compatible MySQL client and retry."); process.exit(1); }
fs.mkdirSync(backupDir, { recursive: true });
const args = ["--host", process.env.DB_HOST, "--port", process.env.DB_PORT || "3306", "--user", process.env.DB_USER, "--single-transaction", "--routines", "--events", "--result-file", target, process.env.DB_NAME];
const result = spawnSync("mysqldump", args, { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || "" }, stdio: "inherit", shell: process.platform === "win32" });
if (result.status !== 0 || !fs.existsSync(target) || fs.statSync(target).size === 0) { console.error("FAIL: backup was not created"); process.exit(1); }
const digest = crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
fs.writeFileSync(`${target}.sha256`, `${digest}  ${filename}\n`, { encoding: "utf8", mode: 0o600 });
const retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || "0", 10);
if (Number.isInteger(retentionDays) && retentionDays > 0) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
        if (!entry.isFile() || !/^.+-\d{4}-\d{2}-\d{2}T.+\.sql(?:\.sha256)?$/.test(entry.name)) continue;
        const candidate = path.join(backupDir, entry.name);
        if (candidate !== target && fs.statSync(candidate).mtimeMs < cutoff) fs.unlinkSync(candidate);
    }
    console.log(`INFO: retained backups newer than ${retentionDays} day(s).`);
}
console.log(`PASS: backup created at ${target}`);
