require("dotenv").config();

const app = require("./app");
const db = require("./config/db");
const seedSuperAdmin = require("./utils/seedSuperAdmin");

const PORT = process.env.PORT || 5000;

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