const multer = require("multer");
const uploadEmployeeImport = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(null, /\.(xlsx|xls)$/i.test(file.originalname || "")) });
module.exports = { uploadEmployeeImport };
