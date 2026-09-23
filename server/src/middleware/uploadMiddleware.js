const multer = require("multer");

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
    // The image exists only in memory for this request before it is sent to
    // authenticated Cloudinary storage. It is never written to local disk.
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

module.exports = {
    uploadAttendancePhoto,
};
