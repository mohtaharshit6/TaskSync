const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerValidators, loginValidators, forgotPasswordValidators, resetPasswordValidators, verifyEmailValidators, resendOtpValidators } = require('../validators/authValidators');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter, generalLimiter } = require('../middleware/rateLimiter');

router.post('/auth/register', authLimiter, registerValidators, validate, authController.register);
router.post('/auth/login', authLimiter, loginValidators, validate, authController.login);
router.post('/auth/refresh', generalLimiter, authController.refresh);
router.post('/auth/logout', generalLimiter, authController.logout);
router.get('/users/me', authMiddleware, authController.me);
router.post('/auth/forgot-password', authLimiter, forgotPasswordValidators, validate, authController.forgotPassword);
router.post('/auth/reset-password', authLimiter, resetPasswordValidators, validate, authController.resetPassword);
router.post('/auth/verify-email', authLimiter, verifyEmailValidators, validate, authController.verifyEmail);
router.post('/auth/resend-otp', authLimiter, resendOtpValidators, validate, authController.resendOtp);

module.exports = router;
