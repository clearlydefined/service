// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/**
 * A scancode license key (e.g., 'mit', 'apache-2.0', 'gpl-3.0')
 */
export type ScancodeKey = string

/**
 * An SPDX license identifier (e.g., 'MIT', 'Apache-2.0', 'GPL-3.0-only')
 * or a LicenseRef-scancode-* reference for licenses not in SPDX
 */
export type SpdxIdentifier = string

/**
 * Mapping from scancode license keys to SPDX identifiers.
 * Based on https://scancode-licensedb.aboutcode.org/index.json
 *
 * @example
 * ```js
 * const scancodeMap = require('./scancodeMap')
 * const spdxId = scancodeMap.get('mit') // 'MIT'
 * const spdxId2 = scancodeMap.get('apache-2.0') // 'Apache-2.0'
 * ```
 */
declare const scancodeMap: Map<ScancodeKey, SpdxIdentifier>

export = scancodeMap
