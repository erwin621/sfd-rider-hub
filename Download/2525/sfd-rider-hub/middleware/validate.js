// middleware/validate.js
// Wraps express-validator's validationResult into a clean 422 response.

'use strict';

const { validationResult } = require('express-validator');

/**
 * Run after a chain of express-validator check() rules.
 * Returns 422 with structured errors if validation fails.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({
        field:   e.path,
        message: e.msg,
        value:   e.value,
      })),
    });
  }
  next();
}

module.exports = { validate };
