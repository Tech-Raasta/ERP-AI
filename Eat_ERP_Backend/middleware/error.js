// const winston = require('winston');
// const logger = require('../lib/logger');
import logger from '../lib/logger.js';

export default function(err, req, res, next) {
  try {
    if (err) {
      logger.log({
        level: "error",
        message: err.message ? err.message: '',
        // stack: err.stack,
        metadata: err.stack ? err.stack: '', // Put what you like as meta
      });
    }
    
    if (res) {
      if (res.headersSent) return res.destroy(err);
      // A controller that forgot to set the status (or a library error) still answers as a failure, never 200
      let status = res.statusCode >= 400 ? res.statusCode : 500;
      let message = res.message ? res.message : 'Something went wrong!';
      if (err && (err.code === 'LIMIT_FILE_SIZE' || err.type === 'entity.too.large')) {
        status = 413;
        message = 'The file or data sent is too large.';
      }
      // The stack only when NODE_ENV=development: anywhere else it would show the code to every user (it stays in the log)
      const detail = process.env.NODE_ENV === 'development' ? { error: err && err.stack ? err.stack : '' } : {};
      res.status(status).json({ message, ...detail });
    }
  } catch (error) {
    console.log(error);
  }
};