import { QueryTypes } from 'sequelize';
import sequelize from './database.js';
import logger from './logger.js';

// Signing out on the server. A sign-in token is valid for days; signing out (or setting a new password by email) moves
// user_master.tokens_valid_from to now, and check-auth / check-login refuse every token issued before it. One column,
// no list of tokens to keep.
// Until migrations/2026-11-03-user-sessions.sql has run the column is missing: sign-out then stays browser-only, as
// before, and nothing else breaks.

let columnMissing = false;

const missing = (error) => {
  if (error && error.parent && error.parent.errno === 1054) {
    if (!columnMissing) logger.log({ level: 'warn', message: 'user_master.tokens_valid_from is missing: run migrations/2026-11-03-user-sessions.sql to make sign-out end the session on the server.' });
    columnMissing = true;
    return true;
  }
  return false;
};

// Tokens issued before this moment (ms) are no longer accepted; null when there is no such moment
export const validFrom = async (userId) => {
  if (columnMissing) return null;
  try {
    const [row] = await sequelize.query(`select unix_timestamp(tokens_valid_from) as valid_from from user_master where id = :userId`, { replacements: { userId }, type: QueryTypes.SELECT });
    // Seconds since 1970 from the database itself, so no timezone conversion can shift the cut-off
    return row && row.valid_from ? Math.round(+row.valid_from * 1000) : null;
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
};

// Ends every session of the user (all browsers). Returns false when the column is missing.
export const endSessions = async (userId) => {
  if (columnMissing) return false;
  try {
    await sequelize.query(`update user_master set tokens_valid_from = now() where id = :userId`, { replacements: { userId } });
    return true;
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
};

// iat is in seconds; a token issued in the same second as the sign-out counts as before it
export const isRevoked = (decodedToken, from) => !!from && (+decodedToken.iat || 0) * 1000 < from;
