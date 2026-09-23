require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");

const failures = [];
const warnings = [];
const requireValue = (name) => {
    if (!String(process.env[name] || "").trim()) failures.push(`${name} is required`);
};

if (process.env.NODE_ENV !== "production") failures.push("NODE_ENV must be production");
["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET", "FRONTEND_URL", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "MAIL_HOST", "MAIL_FROM"].forEach(requireValue);
if (String(process.env.JWT_SECRET || "").length < 32) failures.push("JWT_SECRET must be at least 32 characters");
const configuredOrigins = String(process.env.FRONTEND_URL || "").split(",").map((value) => value.trim()).filter(Boolean);
if (!configuredOrigins.length || configuredOrigins.some((value) => {
    try {
        return new URL(value).protocol !== "https:";
    } catch {
        return true;
    }
})) failures.push("FRONTEND_URL must contain only valid HTTPS frontend origins in production");
const retentionDays = Number.parseInt(process.env.ATTENDANCE_PHOTO_RETENTION_DAYS || "90", 10);
if (!Number.isInteger(retentionDays) || retentionDays < 1) failures.push("ATTENDANCE_PHOTO_RETENTION_DAYS must be a positive integer");
const proxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || "0", 10);
if (!Number.isInteger(proxyHops) || proxyHops < 0) failures.push("TRUST_PROXY_HOPS must be a non-negative integer");
const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
if (!appSource.includes('if (process.env.NODE_ENV !== "production")') || !appSource.includes('app.use("/api/test", testRoutes)')) failures.push("Production test-route gating could not be verified from application source");

failures.forEach((message) => console.log(`FAIL: ${message}`));
warnings.forEach((message) => console.log(`WARNING: ${message}`));
if (!failures.length) console.log("PASS: production environment shape is valid");
process.exitCode = failures.length ? 1 : 0;
