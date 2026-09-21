const { rateLimit } = require("express-rate-limit");

const sendLimit = (_req, res) => res.status(429).json({
    success: false,
    code: "RATE_LIMITED",
    message: "Too many requests. Please wait and try again.",
});

const createLimiter = (windowMs, limit) => rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: undefined,
    handler: sendLimit,
});

module.exports = {
    managementLoginLimiter: createLimiter(15 * 60 * 1000, 10),
    attendanceLoginLimiter: createLimiter(15 * 60 * 1000, 12),
    passwordResetLimiter: createLimiter(60 * 60 * 1000, 5),
    adminRequestLimiter: createLimiter(60 * 60 * 1000, 10),
    setupLimiter: createLimiter(60 * 60 * 1000, 5),
};
