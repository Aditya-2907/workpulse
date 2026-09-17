const cloudinary = require("../config/cloudinary");

const ATTENDANCE_FOLDER = "workpulse/attendance";

const uploadAttendancePhoto = async (filePath) => {
    if (!filePath) {
        throw new Error("Attendance photo file path is required");
    }

    const result = await cloudinary.uploader.upload(filePath, {
        folder: ATTENDANCE_FOLDER,
        resource_type: "image",
    });

    return {
        url: result.secure_url,
        publicId: result.public_id,
    };
};

const deleteAttendancePhoto = async (publicId) => {
    if (!publicId) {
        return null;
    }

    return cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
    });
};

module.exports = {
    uploadAttendancePhoto,
    deleteAttendancePhoto,
};