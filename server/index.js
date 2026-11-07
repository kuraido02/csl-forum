require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require("./db");

const app = express();

// Middleware: runs on every request before your routes
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));

// Test route: checks that the server can talk to MySQL
app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT COUNT(*) AS users FROM users");
    res.json({ status: "ok", users: rows[0].users });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Database connection failed." },
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));