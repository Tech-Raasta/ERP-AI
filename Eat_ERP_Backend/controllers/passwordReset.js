import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/user.js';
import sendEmail from '../lib/email.js';
import logger from '../lib/logger.js';
import { escapeHtml } from '../lib/salesPrint.js';
import { endSessions } from '../lib/sessions.js';
import { endAllSessions } from '../lib/authTokens.js';

dotenv.config();

// Forgot password (old PHP Login::forgot_password_email). PHP mailed the user their password in plain text; here the
// user gets a link that lets them choose a new one:
//  - the link carries a signed token, valid for 30 minutes, made for this purpose only;
//  - the token holds a fingerprint of the current password, so it stops working as soon as the password changes
//    (it can be used once) and nothing has to be stored;
//  - the answer to "send me a link" is the same whether or not the email exists, so the page cannot be used to find
//    out who has an account; a few requests per email and per address are allowed in a quarter of an hour.

const LINK_MINUTES = 30;
const PURPOSE = 'password-reset';
const MIN_LENGTH = 6;
// Same 15 days as a password change from inside the ERP (users.js resetPassword)
const EXPIRY_DAYS = 15;
const SENT_MESSAGE = 'If this email belongs to an active ERP user, a link to set a new password has been sent to it. The link works for 30 minutes.';

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { email: 3, address: 20 };
const recent = new Map();
const tooMany = (key, limit) => {
  const now = Date.now();
  const times = (recent.get(key) || []).filter((time) => now - time < WINDOW_MS);
  times.push(now);
  recent.set(key, times);
  return times.length > limit;
};

const fingerprint = (user) => crypto.createHmac('sha256', process.env.JWTKEY).update(`${user.id}:${user.password || ''}`).digest('hex').substring(0, 32);
const isActive = (user) => !!user && (user.status || '').trim().toUpperCase() !== 'INACTIVE';
const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000/erp').replace(/\/+$/, '');
const fail = (res, status, message, field) => res.status(status).json({
  message,
  ...(field ? { error: { errors: { [field]: { message } } } } : {})
});

// The user a token was made for, or null when it is wrong, expired, or already used
const userOfToken = async (token) => {
  let payload;
  try {
    payload = jwt.verify(String(token || ''), process.env.JWTKEY);
  } catch (error) {
    return null;
  }
  if (!payload || payload.purpose !== PURPOSE) return null;
  const user = await User.findByPk(payload.userId);
  if (!isActive(user) || payload.fp !== fingerprint(user)) return null;
  return user;
};

const resetMail = (user, link) => {
  const name = escapeHtml([user.first_name, user.last_name].filter(Boolean).join(' ') || 'there');
  return `<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937">
    <p>Hi ${name},</p>
    <p>We received a request to reset your Eat ERP password. Click the button below to choose a new one.</p>
    <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#d97706;color:#ffffff;text-decoration:none;border-radius:6px">Set a new password</a></p>
    <p>Or open this address: <br /><a href="${link}">${link}</a></p>
    <p>The link works for ${LINK_MINUTES} minutes and only once. If you did not ask for this, ignore this email; your password stays as it is.</p>
    <p>Thanks,<br />Eat ERP</p>
  </body></html>`;
};

export const forgotPassword = async (req, res, next) => {
  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!email) return fail(res, 422, 'Please enter your email.', 'email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 422, 'Please enter a valid email.', 'email');
    const address = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    if (tooMany(`email:${email}`, LIMITS.email) || tooMany(`address:${address}`, LIMITS.address)) {
      return fail(res, 429, 'Too many requests. Please wait 15 minutes and try again.');
    }

    const user = await User.findOne({ where: { email_id: email } });
    if (isActive(user)) {
      const token = jwt.sign({ userId: user.id, purpose: PURPOSE, fp: fingerprint(user) }, process.env.JWTKEY, { expiresIn: `${LINK_MINUTES}m` });
      const link = `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        // direct: to the user themselves, never to the test mailbox, which could otherwise reset anyone's password
        await sendEmail({ from: process.env.MAIL_EMAIL, to: user.email_id, subject: 'Reset your Eat ERP password', html: resetMail(user, link) }, { direct: true });
      } catch (error) {
        logger.log({ level: 'error', message: `Password reset mail failed for user ${user.id}: ${error.message}` });
        return fail(res, 500, 'The email could not be sent. Please try again in a few minutes.');
      }
    }
    return res.status(200).json({ message: SENT_MESSAGE });
  } catch (error) {
    res.statusCode = 500;
    res.message = 'Sending the reset link failed!';
    next(error, req, res);
  }
  return undefined;
};

// The reset page checks its link before showing the form
export const checkResetLink = async (req, res, next) => {
  try {
    const user = await userOfToken(req.body && req.body.token);
    if (!user) return fail(res, 422, 'This link has expired or was already used. Ask for a new one.');
    return res.status(200).json({ message: 'Link is valid.', email: user.email_id });
  } catch (error) {
    res.statusCode = 500;
    res.message = 'Checking the reset link failed!';
    next(error, req, res);
  }
  return undefined;
};

export const resetPasswordWithLink = async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    const user = await userOfToken(token);
    if (!user) return fail(res, 422, 'This link has expired or was already used. Ask for a new one.');
    const value = String(password || '');
    if (value.length < MIN_LENGTH) return fail(res, 422, `The password must have at least ${MIN_LENGTH} characters.`, 'password');
    if (value !== String(confirmPassword || '')) return fail(res, 422, 'The passwords do not match.', 'confirmPassword');
    if (value === user.password) return fail(res, 422, 'The new password must be different from the current one.', 'password');

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + EXPIRY_DAYS);
    user.password = value;
    user.expiry_date = expiry;
    await user.save();
    await endSessions(user.id);
    await endAllSessions(user.id);
    logger.log({ level: 'info', message: `Password reset by email link for user ${user.id}` });
    return res.status(200).json({ message: 'Your password has been changed. You can sign in with it now.' });
  } catch (error) {
    res.statusCode = 500;
    res.message = 'Changing the password failed!';
    next(error, req, res);
  }
  return undefined;
};
