// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type createCondaRepoAccess from '../lib/condaRepoAccess.ts'

declare function setup(condaForgeRepoAccess: ReturnType<typeof createCondaRepoAccess>): Router

export default setup
