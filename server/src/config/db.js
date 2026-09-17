const mysql = require("mysql2/promise");
require("dotenv").config();

console.log("DB ENV CHECK:");
console.log("HOST:", process.env.DB_HOST);
console.log("PORT:", process.env.DB_PORT);
console.log("USER:", process.env.DB_USER);
console.log("DATABASE:", process.env.DB_NAME);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // WorkPulse operates in India.
  // Keep every application DB connection on IST even when
  // the database server itself runs in UTC (e.g. Railway).
  timezone: "+05:30",

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+05:30'", (error) => {
    if (error) {
      console.error("Failed to set MySQL session timezone:", error);
    }
  });
});

module.exports = pool;