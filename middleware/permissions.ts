// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RequestHandler } from 'express'

import asyncMiddleware from './asyncMiddleware.ts'

/**
 * Permission names that can be checked.
 * These correspond to GitHub team memberships.
 */
export type PermissionName = 'harvest' | 'curate' | string

/**
 * Map of permission names to the GitHub team names that grant that permission.
 */
export interface PermissionsConfig {
  [permission: string]: string[]
}

/**
 * Creates middleware that checks if the user has the required permission.
 * Permission is granted based on GitHub team membership.
 * If the user does not have permission, returns a 401 error.
 */
function permissionsCheck(permission: PermissionName): RequestHandler {
  return asyncMiddleware(async function permissionsCheck(request, _response, next) {
    const userTeams = await request.app.locals.user?.github?.getTeams?.()
    const requiredTeams = permissions?.[permission] ?? []
    const intersection = requiredTeams.filter(t => (userTeams || []).includes(t))
    if (requiredTeams.length !== 0 && intersection.length === 0) {
      const error = new Error(`No permission to '${permission}' (needs team membership)`) as Error & { status?: number }
      error.status = 401
      next(error)
    } else {
      next()
    }
  })
}

let permissions: PermissionsConfig | undefined

/**
 * Sets up the permissions module with the given configuration.
 */
function setup(permissionsOptions: PermissionsConfig): void {
  permissions = permissionsOptions
}

export { permissionsCheck, setup }
