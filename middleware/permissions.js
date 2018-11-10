// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Middleware that checks for team membership.
 *
 * Usage: `app.get('/some/route', teamCheck('harvesters'), (req, res) => ...)`
 */
function middlewareFactory(permission) {
  return (request, response, next) => {
    const userTeams = request.app.locals.user.github.teams
    const requiredTeams = permissions[permission]
    const intersection = requiredTeams.filter(t => userTeams.includes(t))
    if (requiredTeams.length === 0 || intersection.length > 0) return next()
    const error = new Error(`No permission to '${permission}' (needs team membership)`)
    error.status = 401
    next(error)
  }
}

let permissions

function setup(permissionsOptions) {
  permissions = permissionsOptions
}

module.exports = { setup, middlewareFactory }
