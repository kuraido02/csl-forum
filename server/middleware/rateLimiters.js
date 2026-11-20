const { rateLimit } = require("express-rate-limit");
const { sendError } = require("../utils/http");

function makeLimiter({
  windowMinutes,
  max,
  message,
  onlyFailures = false,
  onlySuccesses = false,
  perUser = false,
}) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: onlyFailures,
    skipFailedRequests: onlySuccesses,
    // perUser: count by the logged-in user's id instead of the IP address.
    // requireAuth must run BEFORE this limiter, so req.user exists.
    ...(perUser ? { keyGenerator: (req) => `user-${req.user.id}` } : {}),
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

// Creating posts: 10 per hour per user. Only successful posts count,
// so fixing a validation mistake never uses up the allowance.
const postLimiter = makeLimiter({
  windowMinutes: 60,
  max: 10,
  onlySuccesses: true,
  perUser: true,
  message: "You are posting too fast. Try again in a little while.",
});

module.exports = { loginLimiter, emailLimiter, registerLimiter, postLimiter };