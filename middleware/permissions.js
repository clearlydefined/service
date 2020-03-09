// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const asyncMiddleware = require('./asyncMiddleware')

/**
 * Middleware that checks for permissions for this request based on team membership.
 *
 * Usage: `app.get('/some/route', permissionsCheck('harvesters'), (req, res) => ...)`
 */
function permissionsCheck(permission) {
  return asyncMiddleware(async function permissionsCheck(request, response, next) {
    const userTeams = await request.app.locals.user.github.getTeams()
    const requiredTeams = permissions[permission]
    const intersection = requiredTeams.filter(t => (userTeams || []).includes(t))
    if (requiredTeams.length !== 0 && intersection.length == 0) {
      const error = new Error(`No permission to '${permission}' (needs team membership)`)
      error.status = 401
      next(error)
    } else {
      next()
    }
  })
}

let permissions

function setup(permissionsOptions) {
  permissions = permissionsOptions
}

module.exports = { setup, permissionsCheck }
