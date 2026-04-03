// Global test setup for node:test runner
// Initializes the logger singleton before any test code runs

const logger = require('../providers/logging/logger')
logger({
  info: () => { },
  error: () => { },
  warn: () => { },
  debug: () => { },
  log: () => { }
})
