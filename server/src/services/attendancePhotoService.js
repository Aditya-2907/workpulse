const cloudinary = require("../config/cloudinary");

const ATTENDANCE_FOLDER = "workpulse/attendance";

const uploadAttendancePhoto = async (fileBuffer) => {
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        throw new Error("Attendance photo data is required");
    }

    const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder: ATTENDANCE_FOLDER,
            resource_type: "image",
            type: "authenticated",
        }, (error, uploadResult) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(uploadResult);
        });

        stream.end(fileBuffer);
    });

    return {
        url: result.secure_url,
        publicId: result.public_id,
    };
};

const deleteAttendancePhoto = async (publicId, storedPath = "") => {
    if (!publicId) {
        return null;
    }

    return cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        type: String(storedPath).includes("/authenticated/") ? "authenticated" : "upload",
    });
};

const getAttendancePhotoDeliveryUrl = (publicId, storedPath) => {
    if (!publicId) return storedPath || null;
    const type = String(storedPath || "").includes("/authenticated/") ? "authenticated" : "upload";
    return cloudinary.url(publicId, { resource_type: "image", type, sign_url: type === "authenticated", secure: true });
};

module.exports = {
    uploadAttendancePhoto,
    deleteAttendancePhoto,
    getAttendancePhotoDeliveryUrl,
};
