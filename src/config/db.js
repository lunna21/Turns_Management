const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function connectDB(retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      connection.release();
      console.log("Successfully connected to the database.");
      return;
    } catch (error) {
      console.log(
        `Database connection attempt ${i + 1} failed:`,
        error.message
      );
      if (i === retries - 1) {
        console.error("All database connection attempts failed.");
        throw error;
      }
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = { pool, connectDB };
