require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require("./db");
const path = require("path");
const { sendError } = require("./utils/http");

const app = express();

// Middleware: runs on every request before your routes
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api", require("./routes/verification"));

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

// Any URL that no route handled
app.use((req, res) => {
  sendError(res, 404, "NOT_FOUND", "Route not found.");
});

// Any error that was thrown or passed to next(err)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === "entity.parse.failed") {
    return sendError(res, 400, "VALIDATION_ERROR", "Request body is not valid JSON.");
  }

  console.error(err);
  sendError(res, 500, "SERVER_ERROR", "Something went wrong.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));