// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type Ajv from 'ajv'

/**
 * Pre-configured Ajv instance with all application schemas registered.
 *
 * Registered schemas (referenced by key):
 * - `curations` — curations-1.0.json
 * - `curation` — curation-1.0.json
 * - `definition` — definition-1.0.json
 * - `harvest` — harvest-1.0.json
 * - `notice-request` — notice-request.json
 * - `definitions-find` — definitions-find.json
 * - `definitions-get-dto` — definitions-get-dto-1.0.json
 * - `coordinates-1.0` — coordinates-1.0.json
 * - `versionless-coordinates-1.0` — versionless-coordinates-1.0.json
 */
declare const ajv: Ajv

export default ajv
