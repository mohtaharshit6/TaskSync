const rateLimit = require('express-rate-limit');

const authLimiter = (req, res, next) => next();

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { authLimiter, generalLimiter };
