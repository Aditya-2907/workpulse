const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(
    __dirname,
    "..",
    "uploads",
    "attendance"
);

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const uniqueName =
            `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

        const extension = path.extname(file.originalname) || ".jpg";

        cb(
            null,
            `attendance-${uniqueName}${extension}`
        );
    },
});

const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png" ||
        file.mimetype === "image/webp"
    ) {
        cb(null, true);
    } else {
        cb(
            new Error("Only image files are allowed"),
            false
        );
    }
};

const uploadAttendancePhoto = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

module.exports = {
    uploadAttendancePhoto,
};