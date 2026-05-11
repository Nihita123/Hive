import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Strict limiter for auth endpoints.
 * Prevents brute-force attacks on login/register.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_REQUESTS",
    message: "Too many auth attempts. Please try again in 15 minutes.",
  },
});

/**
 * Limiter for code execution endpoint.
 * Docker containers are expensive — cap submissions per user.
 */
export const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req),
  message: {
    error: "TOO_MANY_REQUESTS",
    message: "Execution rate limit exceeded. Max 10 runs per minute.",
  },
});

/**
 * General API limiter applied to all routes.
 * Loose enough not to affect normal usage.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_REQUESTS",
    message: "Too many requests. Please slow down.",
  },
});
