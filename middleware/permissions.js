// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * Middleware that checks for team membership.
 *
 * Usage: `app.get('/some/route', teamCheck('harvesters'), (req, res) => ...)`
 */
function middlewareFactory(permission) {
  return (req, res, next) => {
    const userTeams = req.app.locals.user.github.teams
    const requiredTeams = permissions[permission]
    const intersection = requiredTeams.filter(t => userTeams.includes(t))
    if (requiredTeams.length === 0 || intersection.length > 0) {
      next()
    } else {
      const err = new Error(`No permission to '${permission}' (needs team membership)`)
      err.status = 401
      next(err)
    }
  }
}

let permissions

function setup(permissionsOptions) {
  permissions = permissionsOptions
}

module.exports = { setup, middlewareFactory }
