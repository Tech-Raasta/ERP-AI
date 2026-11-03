import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import User from '../models/user.js';
import { validFrom, isRevoked } from '../lib/sessions.js';
import { isAccessToken, sessionActive } from '../lib/authTokens.js';

dotenv.config();

// The caller must be logged in and active. Unlike check-auth there is no password expiry or role section check:
// a user whose password has expired has to be able to reach the password change.
export default async (req, res, next) => {
  try {
    const header = req.headers && req.headers.authorization;
    if (!header || header.indexOf(' ') === -1) {
      return res.status(400).json({ message: "You are not authenticated!" });
    }
    const decodedToken = jwt.verify(header.split(' ')[1], process.env.JWTKEY);
    if (!isAccessToken(decodedToken)) {
      return res.status(400).json({ message: "Invalid token!" });
    }
    const user = await User.findByPk(decodedToken.userId);
    if (!user || (user.status || '').trim().toUpperCase() === 'INACTIVE') {
      return res.status(400).json({ message: "Your account is not active. Please contact your administrator." });
    }
    if (decodedToken.sid ? !(await sessionActive(decodedToken.sid)) : isRevoked(decodedToken, await validFrom(user.id))) {
      return res.status(400).json({ message: "You have been signed out. Please sign in again." });
    }
    req.userData = { email: decodedToken.email, userId: decodedToken.userId, userRoleId: user.role_id, depotIds: user.depot_ids ? user.depot_ids.split(',') : [] };
    next();
  } catch (error) {
    if (error && error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: "Your session has expired. Please sign in again.", code: 'TOKEN_EXPIRED' });
    }
    if (['JsonWebTokenError', 'NotBeforeError'].includes(error && error.name)) {
      return res.status(400).json({ message: "Invalid token!" });
    }
    res.statusCode = 500;
    res.message = "Checking your sign-in failed!";
    return next(error, req, res);
  }
};
