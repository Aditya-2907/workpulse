require("dotenv").config();

const app = require("./app");
const db = require("./config/db");
const seedSuperAdmin = require("./utils/seedSuperAdmin");

const PORT = process.env.PORT || 5000;

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection", { message: reason instanceof Error ? reason.message : "Unknown rejection" });
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception", { message: error.message });
    process.exit(1);
});

const startServer = async () => {
    try {
        const connection = await db.getConnection();

        console.log("MySQL database connected successfully");

        connection.release();

        await seedSuperAdmin();

        app.listen(PORT, () => {
            console.log(`WorkPulse API running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Database connection failed:");
        console.error(error.message);
        process.exit(1);
    }
};

startServer();
