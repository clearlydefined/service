// Copyright (c) Amazon.com, Inc. or its affiliates and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { RequestHandler } from 'express'

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
 * Sets up the permissions module with the given configuration.
 *
 * @param permissionsOptions - Map of permission names to team names
 *
 * @example
 * ```js
 * const { setup } = require('./permissions')
 *
 * setup({
 *   harvest: ['harvest-dev', 'harvest-prod'],
 *   curate: ['curation-dev', 'curation-prod']
 * })
 * ```
 */
export function setup(permissionsOptions: PermissionsConfig): void

/**
 * Creates middleware that checks if the user has the required permission.
 * Permission is granted based on GitHub team membership.
 *
 * If the user does not have permission, returns a 401 error.
 *
 * @param permission - The permission name to check
 * @returns Express middleware that checks the permission
 *
 * @example
 * ```js
 * const { permissionsCheck } = require('./permissions')
 *
 * app.post('/harvest', permissionsCheck('harvest'), (req, res) => {
 *   // Only users in harvest teams can reach this
 * })
 * ```
 */
export function permissionsCheck(permission: PermissionName): RequestHandler
