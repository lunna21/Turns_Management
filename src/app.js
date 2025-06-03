const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 

dotenv.config();

const turnsRoutes = require("./routes/turns");
const schedulesRoutes = require("./routes/schedules");
const attendanceRoutes = require("./routes/attendance");
const { connectDB } = require("./config/db");

const app = express();
const PORT = 3000;

app.use(cors());

app.use(express.json());

// API Routes
app.use("/api/turns", turnsRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/attendance", attendanceRoutes);

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
