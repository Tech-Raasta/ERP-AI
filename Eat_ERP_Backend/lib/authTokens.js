import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { QueryTypes } from 'sequelize';
import sequelize from './database.js';
import logger from './logger.js';
import { validFrom, isRevoked } from './sessions.js';

dotenv.config();

// Sign-in sessions.
//  - Access token: a JWT valid for 15 minutes (models/user.js generateAuthToken), sent as "Authorization: Bearer". The frontend keeps it in memory only
//    (never localStorage), so a script that reads storage finds nothing.
//  - Refresh token: 48 random bytes in an httpOnly, SameSite=Strict cookie that only /api/user/... receives. Scripts
//    cannot read it. The database keeps only its SHA-256 hash (user_refresh_tokens).
//  - Every refresh rotates it: the old one is marked replaced, a new one is set. Presenting a replaced token again means
//    it was copied, so the whole sign-in (family) is ended. Two tabs refreshing at the same moment are allowed for a
//    few seconds (GRACE_SECONDS) without ending anything.
//  - "Remember me": the cookie lasts 30 days and each use extends it, up to 90 days after signing in. Without it the
//    cookie ends with the browser, and the server ends it after 12 hours anyway.
//  - Until migrations/2026-11-03-refresh-tokens.sql has run there is no table: the cookie then holds a signed token
//    instead (same cookie, same lifetimes, renewed on every refresh), so sessions still survive reloads and new tabs.
//    What it cannot do is notice a copied cookie or end one browser's session on the server: run the migration for that.

export const ACCESS_MINUTES = 15;
const REMEMBER_DAYS = 30;
const SESSION_HOURS = 12;
const MAX_SESSION_DAYS = 90;
const GRACE_SECONDS = 20;
export const REFRESH_COOKIE = 'erp_rt';
const COOKIE_PATH = '/api/user';
const ACCESS_TYPE = 'access';

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const addMs = (ms) => new Date(Date.now() + ms);
const DAY = 24 * 60 * 60 * 1000;

// Only access tokens open the API: not a password-reset link token, not a token of any other purpose.
// Tokens from before this change carry no type and still work until they expire.
export const isAccessToken = (decoded) => !!decoded && !decoded.purpose && (decoded.typ === undefined || decoded.typ === ACCESS_TYPE);

// ---------- Cookie ----------

const readCookie = (req, name) => {
  const header = (req.headers && req.headers.cookie) || '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return '';
};

// Secure everywhere but plain-http localhost (development)
const isSecure = (req) => req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https') || /^https:/i.test(process.env.FRONTEND_URL || '') && !/localhost|127\.0\.0\.1/.test(String(req.headers.host || ''));

const cookieText = (req, value, maxAgeSeconds) => [
  `${REFRESH_COOKIE}=${encodeURIComponent(value)}`,
  `Path=${COOKIE_PATH}`,
  'HttpOnly',
  'SameSite=Strict',
  ...(isSecure(req) ? ['Secure'] : []),
  ...(maxAgeSeconds === null ? [] : [`Max-Age=${maxAgeSeconds}`]),
].join('; ');

const setRefreshCookie = (req, res, value, remember, expiresAt) => {
  res.setHeader('Set-Cookie', cookieText(req, value, remember ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : null));
};

export const clearRefreshCookie = (req, res) => res.setHeader('Set-Cookie', cookieText(req, '', 0));

// ---------- Store ----------

const RECHECK_MS = 5 * 60 * 1000;
let missingUntil = 0;
const tableMissingNow = () => Date.now() < missingUntil;
const missing = (error) => {
  if (error && error.parent && error.parent.errno === 1146) {
    if (!missingUntil) logger.log({ level: 'warn', message: 'user_refresh_tokens is missing: run migrations/2026-11-03-refresh-tokens.sql. Until then the session cookie holds a signed token (no copied-cookie check).' });
    missingUntil = Date.now() + RECHECK_MS;
    return true;
  }
  return false;
};

// ---------- Without the table: a signed token in the cookie ----------

// Its own key, so it can never pass as an access token (and an access token never passes as this)
const refreshKey = () => `${process.env.JWTKEY}:refresh-cookie`;
const looksSigned = (value) => value.split('.').length === 3;

const issueSigned = (req, res, { userId, sid, remember, sessionEnds }) => {
  const ends = Math.min(sessionEnds, remember ? Date.now() + REMEMBER_DAYS * DAY : sessionEnds);
  const seconds = Math.max(60, Math.floor((ends - Date.now()) / 1000));
  const value = jwt.sign({ uid: userId, sid, rem: remember ? 1 : 0, sexp: sessionEnds }, refreshKey(), { expiresIn: seconds });
  setRefreshCookie(req, res, value, remember, new Date(ends));
};

const rotateSigned = async (req, res, value) => {
  let payload;
  try {
    payload = jwt.verify(value, refreshKey());
  } catch (error) {
    clearRefreshCookie(req, res);
    return { error: error.name === 'TokenExpiredError' ? 'Your session has expired. Please sign in again.' : 'No session.' };
  }
  if (Date.now() > +payload.sexp || isRevoked(payload, await validFrom(payload.uid))) {
    clearRefreshCookie(req, res);
    return { error: 'Your session has ended. Please sign in again.' };
  }
  issueSigned(req, res, { userId: payload.uid, sid: payload.sid, remember: !!payload.rem, sessionEnds: +payload.sexp });
  return { userId: payload.uid, family: payload.sid };
};
const select = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const execute = (sql, replacements) => sequelize.query(sql, { replacements });

const clientOf = (req) => ({
  userAgent: String(req.headers['user-agent'] || '').substring(0, 255),
  ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().substring(0, 64),
});

const insertToken = async (req, { userId, family, remember, sessionExpiresAt }) => {
  const value = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Math.min(
    sessionExpiresAt.getTime(),
    remember ? Date.now() + REMEMBER_DAYS * DAY : Date.now() + SESSION_HOURS * 60 * 60 * 1000
  ));
  const { userAgent, ip } = clientOf(req);
  await execute(
    `insert into user_refresh_tokens (user_id, family, token_hash, remember, expires_at, session_expires_at, created_on, user_agent, ip)
     values (:userId, :family, :tokenHash, :remember, :expiresAt, :sessionExpiresAt, now(), :userAgent, :ip)`,
    { userId, family, tokenHash: hash(value), remember: remember ? 1 : 0, expiresAt, sessionExpiresAt, userAgent, ip }
  );
  return { value, expiresAt, tokenHash: hash(value) };
};

// A new sign-in: a new family (the cookie is set), returned
export const startSession = async (req, res, userId, remember) => {
  const sessionExpiresAt = remember ? addMs(MAX_SESSION_DAYS * DAY) : addMs(SESSION_HOURS * 60 * 60 * 1000);
  const family = crypto.randomBytes(16).toString('hex');
  if (!tableMissingNow()) {
    try {
      const token = await insertToken(req, { userId, family, remember, sessionExpiresAt });
      setRefreshCookie(req, res, token.value, remember, token.expiresAt);
      return family;
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  issueSigned(req, res, { userId, sid: family, remember, sessionEnds: sessionExpiresAt.getTime() });
  return family;
};

const revokeFamily = (family) => execute(`update user_refresh_tokens set revoked_on = now() where family = :family and revoked_on is null`, { family });

// The refresh: { userId } for a good cookie (a new cookie is set), or { error } when the session is over
export const rotateSession = async (req, res) => {
  const value = readCookie(req, REFRESH_COOKIE);
  if (!value) return { error: 'No session.' };
  // A cookie from before the migration keeps working after it
  if (looksSigned(value)) return rotateSigned(req, res, value);
  if (tableMissingNow()) return { error: 'No session.' };
  let rows;
  try {
    rows = await select(
      `select id, user_id, family, remember, session_expires_at, replaced_by_hash,
         (expires_at < now()) as expired, (session_expires_at < now()) as session_over,
         revoked_on is not null as revoked, timestampdiff(second, revoked_on, now()) as revoked_seconds
       from user_refresh_tokens where token_hash = :tokenHash`,
      { tokenHash: hash(value) }
    );
  } catch (error) {
    if (missing(error)) return { error: 'No session.' };
    throw error;
  }
  const row = rows[0];
  if (!row) {
    clearRefreshCookie(req, res);
    return { error: 'No session.' };
  }
  if (+row.revoked) {
    // The other tab has just refreshed with this token: let this one through without a new cookie
    if (row.replaced_by_hash && +row.revoked_seconds <= GRACE_SECONDS) return { userId: row.user_id, family: row.family };
    // A replaced token used again: whoever holds it is not the user. End that sign-in everywhere.
    if (row.replaced_by_hash) {
      await revokeFamily(row.family);
      logger.log({ level: 'warn', message: `Refresh token reused for user ${row.user_id}; session family ${row.family} ended.` });
    }
    clearRefreshCookie(req, res);
    return { error: 'Your session has ended. Please sign in again.' };
  }
  if (+row.expired || +row.session_over) {
    await execute(`update user_refresh_tokens set revoked_on = now() where id = :id`, { id: row.id });
    clearRefreshCookie(req, res);
    return { error: 'Your session has expired. Please sign in again.' };
  }
  const next = await insertToken(req, { userId: row.user_id, family: row.family, remember: !!+row.remember, sessionExpiresAt: new Date(row.session_expires_at) });
  // Only the first of two tabs wins the rotation; the other falls into the grace branch above
  const [result] = await execute(
    `update user_refresh_tokens set revoked_on = now(), replaced_by_hash = :next where id = :id and revoked_on is null`,
    { id: row.id, next: next.tokenHash }
  );
  if (result && result.affectedRows === 0) {
    await execute(`delete from user_refresh_tokens where token_hash = :tokenHash`, { tokenHash: next.tokenHash });
    return { userId: row.user_id, family: row.family };
  }
  setRefreshCookie(req, res, next.value, !!+row.remember, next.expiresAt);
  return { userId: row.user_id, family: row.family };
};

// Sign-out of this browser: its family ends and the cookie goes
export const endSessionOfCookie = async (req, res) => {
  const value = readCookie(req, REFRESH_COOKIE);
  clearRefreshCookie(req, res);
  if (looksSigned(value)) {
    try {
      return jwt.verify(value, refreshKey()).uid;
    } catch (error) {
      return null;
    }
  }
  if (!value || tableMissingNow()) return null;
  try {
    const [row] = await select(`select user_id, family from user_refresh_tokens where token_hash = :tokenHash`, { tokenHash: hash(value) });
    if (!row) return null;
    await revokeFamily(row.family);
    return row.user_id;
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
};

// Is this sign-in still on? (check-auth, for every request carrying an access token with a sid)
export const sessionActive = async (sid) => {
  if (tableMissingNow()) return true;
  try {
    const rows = await select(
      `select 1 as ok from user_refresh_tokens where family = :sid and revoked_on is null and session_expires_at > now() limit 1`,
      { sid }
    );
    return rows.length > 0;
  } catch (error) {
    if (missing(error)) return true;
    throw error;
  }
};

// Every session of a user (new password, deactivated, "sign out everywhere")
export const endAllSessions = async (userId) => {
  if (tableMissingNow()) return;
  try {
    await execute(`update user_refresh_tokens set revoked_on = now() where user_id = :userId and revoked_on is null`, { userId });
  } catch (error) {
    if (!missing(error)) throw error;
  }
};

// Old rows are of no use; a sign-in keeps them for a day after they end, for the reuse check
export const pruneSessions = async () => {
  if (tableMissingNow()) return;
  try {
    await execute(`delete from user_refresh_tokens where session_expires_at < now() - interval 1 day or (revoked_on is not null and revoked_on < now() - interval 1 day)`);
  } catch (error) {
    if (!missing(error)) throw error;
  }
};
