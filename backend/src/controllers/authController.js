const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendEmail, isEmailEnabled } = require('../services/emailService');
const prisma = new PrismaClient();

const generateAccessToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });

const generateRefreshToken = (user) =>
  jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  });

const setRefreshCookie = (res, token) =>
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

const refreshExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash, isActive: false } });

    const otp = generateOtp();
    await prisma.emailVerificationOtp.create({
      data: { userId: user.id, otp: hashOtp(otp), expiresAt: new Date(Date.now() + 15 * 60 * 1000) }
    });

    if (isEmailEnabled()) {
      try {
        await sendEmail({
          to: email,
          subject: 'TaskSync — Verify your email',
          html: `<p>Your verification code is:</p><h2>${otp}</h2><p>It expires in 15 minutes.</p>`
        });
      } catch (mailErr) {
        // Roll back so the account is not stranded (unverified + un-resendable)
        await prisma.emailVerificationOtp.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
        return res.status(502).json({ success: false, message: 'Could not send verification email. Please try again.' });
      }
      res.status(201).json({ success: true, message: 'Account created. Check your email for the verification code.' });
    } else {
      res.status(201).json({ success: true, message: 'Account created. Enter the OTP to verify.', otp });
    }
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Please verify your email before logging in.', needsVerification: true, email: user.email });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() } });
    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      data: { accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email } }
    });
  } catch (err) { next(err); }
};

exports.refresh = async (req, res, next) => {
  try {
    // Accept the token from the request body (localStorage fallback) or the
    // httpOnly cookie. The body path works even when browsers block the
    // cross-site cookie (Vercel frontend ↔ Render backend).
    const token = req.body?.refreshToken || req.cookies.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    let decoded;
    try { decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid refresh token' }); }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // deleteMany instead of delete — safe if a concurrent request already removed this token
    await prisma.refreshToken.deleteMany({ where: { token } });
    const newRefresh = generateRefreshToken(user);
    await prisma.refreshToken.create({ data: { token: newRefresh, userId: user.id, expiresAt: refreshExpiry() } });
    setRefreshCookie(res, newRefresh);

    res.json({ success: true, data: { accessToken: generateAccessToken(user), refreshToken: newRefresh } });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    const token = req.body?.refreshToken || req.cookies.refreshToken;
    if (token) await prisma.refreshToken.deleteMany({ where: { token } });
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return same response to prevent email enumeration
    if (!user || !user.isActive) {
      return res.json({ success: true, message: 'If that email is registered, an OTP has been sent.' });
    }

    // Invalidate previous OTPs
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true }
    });

    const otp = generateOtp();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: hashOtp(otp), expiresAt: new Date(Date.now() + 15 * 60 * 1000) }
    });

    if (isEmailEnabled()) {
      try {
        await sendEmail({
          to: user.email,
          subject: 'TaskSync — Password Reset OTP',
          html: `<p>Your password reset OTP is:</p><h2 style="letter-spacing:4px">${otp}</h2><p>It expires in 15 minutes. Do not share this with anyone.</p>`
        });
      } catch (mailErr) {
        return res.status(502).json({ success: false, message: 'Could not send the OTP email. Please try again.' });
      }
    } else {
      console.log(`\n[DEV] Password reset OTP for ${user.email}: ${otp}\n`);
    }

    res.json({ success: true, message: 'If that email is registered, an OTP has been sent.' });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid request' });

    const record = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, token: hashOtp(otp), used: false, expiresAt: { gt: new Date() } }
    });
    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from your current password.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) { next(err); }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid request' });
    if (user.isActive) return res.status(400).json({ success: false, message: 'Email already verified' });

    const record = await prisma.emailVerificationOtp.findFirst({
      where: { userId: user.id, otp: hashOtp(otp), used: false, expiresAt: { gt: new Date() } }
    });
    if (!record) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

    await prisma.emailVerificationOtp.update({ where: { id: record.id }, data: { used: true } });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });

    res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (err) { next(err); }
};

exports.resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isActive) return res.json({ success: true, message: 'If applicable, a new OTP was sent.' });

    // Invalidate old OTPs
    await prisma.emailVerificationOtp.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });

    const otp = generateOtp();
    await prisma.emailVerificationOtp.create({
      data: { userId: user.id, otp: hashOtp(otp), expiresAt: new Date(Date.now() + 15 * 60 * 1000) }
    });

    if (isEmailEnabled()) {
      try {
        await sendEmail({
          to: email,
          subject: 'TaskSync — New Verification Code',
          html: `<p>Your new verification code is:</p><h2>${otp}</h2><p>It expires in 15 minutes.</p>`
        });
      } catch (mailErr) {
        return res.status(502).json({ success: false, message: 'Could not send the OTP email. Please try again.' });
      }
      res.json({ success: true, message: 'New OTP sent to your email.' });
    } else {
      res.json({ success: true, message: 'New OTP generated.', otp });
    }
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};
