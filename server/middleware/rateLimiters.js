const { rateLimit } = require("express-rate-limit");
const { sendError } = require("../utils/http");

function makeLimiter({ windowMinutes, max, message, onlyFailures = false }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: onlyFailures,
    handler: (req, res) => sendError(res, 429, "RATE_LIMITED", message),
  });
}

// Wrong passwords: only failed logins count, so normal users are never blocked
const loginLimiter = makeLimiter({
  windowMinutes: 15,
  max: 20,
  onlyFailures: true,
  message: "Too many failed login attempts. Try again in a few minutes.",
});

// Endpoints that send emails
const emailLimiter = makeLimiter({
  windowMinutes: 15,
  max: 5,
  message: "Too many requests. Try again in a few minutes.",
});

// Creating accounts
const registerLimiter = makeLimiter({
  windowMinutes: 60,
  max: 30,
  message: "Too many sign-ups from this network. Try again later.",
});

module.exports = { loginLimiter, emailLimiter, registerLimiter };