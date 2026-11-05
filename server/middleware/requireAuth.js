const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/http");

function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    return sendError(res, 401, "UNAUTHENTICATED", "Session expired. Please log in again.");
  }
}

module.exports = requireAuth;