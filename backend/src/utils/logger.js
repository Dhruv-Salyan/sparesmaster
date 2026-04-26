// src/utils/logger.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralised logger using Winston.
// Usage anywhere in the app:
//   const logger = require('../utils/logger');
//   logger.info('Server started');
//   logger.error('Something broke', { error: err.message });
// ─────────────────────────────────────────────────────────────────────────────

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = format;

// ── Custom log line format ────────────────────────────────────────────────────
const logLine = printf(({ level, message, timestamp, stack }) => {
  // If an Error was passed, show the stack trace
  return stack
    ? `${timestamp}  [${level}]  ${message}\n${stack}`
    : `${timestamp}  [${level}]  ${message}`;
});

// ── Logger instance ───────────────────────────────────────────────────────────
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',

  format: combine(
    errors({ stack: true }),   // capture stack traces on Error objects
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logLine
  ),

  transports: [
    // Console: coloured output for easy reading during development
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        logLine
      ),
    }),

    // File: plain text, rotated manually or by a process manager
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
    }),
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
    }),
  ],
});

module.exports = logger;
