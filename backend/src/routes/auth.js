// src/routes/auth.js
// ─────────────────────────────────────────────────────────────────────────────
// Route definitions for /api/auth
//
// Route table:
//   POST  /api/auth/register         → register new user
//   POST  /api/auth/login            → login and receive JWT
//   POST  /api/auth/logout           → clear session cookie
//   GET   /api/auth/me               → return current user (requires auth)
//   POST  /api/auth/forgot-password  → send reset email
//   POST  /api/auth/reset-password   → set new password via reset token
// ─────────────────────────────────────────────────────────────────────────────

const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../middleware/validateAuth');

router.post('/register',        validateRegister,       ctrl.register);
router.post('/login',           validateLogin,          ctrl.login);
router.post('/logout',                                  ctrl.logout);
router.get( '/me',              authenticate,           ctrl.me);
router.post('/forgot-password', validateForgotPassword, ctrl.forgotPassword);
router.post('/reset-password',  validateResetPassword,  ctrl.resetPassword);

module.exports = router;
