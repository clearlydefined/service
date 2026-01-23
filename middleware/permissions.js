// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */
/** @typedef {import('express').RequestHandler} RequestHandler */
/** @typedef {import('./permissions').PermissionName} PermissionName */
/** @typedef {import('./permissions').PermissionsConfig} PermissionsConfig */

const asyncMiddleware = require('./asyncMiddleware')

/**
 * Creates middleware that checks if the user has the required permission.
 * Permission is granted based on GitHub team membership.
 * If the user does not have permission, returns a 401 error.
 *
 * @param {PermissionName} permission - The permission name to check
 * @returns {RequestHandler} Express middleware that checks the permission
 *
 * @example
 * app.post('/harvest', permissionsCheck('harvest'), (req, res) => {
 *   // Only users in harvest teams can reach this
 * })
 */
function permissionsCheck(permission) {
  return asyncMiddleware(async function permissionsCheck(request, _response, next) {
    const userTeams = await request.app.locals.user.github.getTeams()
    const requiredTeams = permissions[permission]
    const intersection = requiredTeams.filter(t => (userTeams || []).includes(t))
    if (requiredTeams.length !== 0 && intersection.length === 0) {
      /** @type {Error & { status?: number }} */
      const error = new Error(`No permission to '${permission}' (needs team membership)`)
      error.status = 401
      next(error)
    } else {
      next()
    }
  })
}

/** @type {PermissionsConfig | undefined} */
let permissions

/**
 * Sets up the permissions module with the given configuration.
 *
 * @param {PermissionsConfig} permissionsOptions - Map of permission names to team names
 */
function setup(permissionsOptions) {
  permissions = permissionsOptions
}

module.exports = { setup, permissionsCheck }
