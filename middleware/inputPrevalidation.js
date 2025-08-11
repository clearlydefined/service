const { isTooDeepOrLarge } = require('../lib/utils')

const MAX_DEPTH = 10
const MAX_ARRAY_LENGTH = 500

module.exports = function inputPrevalidation(req, res, next) {
  // Only check JSON bodies
  if (req.body && isTooDeepOrLarge(req.body, MAX_DEPTH, MAX_ARRAY_LENGTH)) {
    return res.status(400).json({ error: 'Request body too large or too deeply nested' })
  }
  next()
}
