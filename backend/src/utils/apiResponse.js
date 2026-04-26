// src/utils/apiResponse.js
// ─────────────────────────────────────────────────────────────────────────────
// Standardised response helpers so every endpoint returns the same shape:
//
//   { success: true,  message: "...", data: <payload>  }
//   { success: false, message: "...", errors: [...]     }
//
// Usage in a controller:
//   res.status(200).json(ok(res, 'Items fetched', items));
//   res.status(400).json(fail(res, 'Validation failed', errors));
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a success response object.
 * @param {string}  message   - Human-readable success message
 * @param {*}       data      - Payload (array, object, or null)
 * @param {object}  [meta]    - Optional extra fields (e.g. { count: 42 })
 */
function ok(message, data = null, meta = {}) {
  return {
    success: true,
    message,
    data,
    ...meta,
  };
}

/**
 * Build a failure response object.
 * @param {string}        message   - Human-readable error summary
 * @param {Array|null}    errors    - Detailed error list (validation errors, etc.)
 */
function fail(message, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return body;
}

module.exports = { ok, fail };
