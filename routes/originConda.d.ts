// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type createCondaRepoAccess from '../lib/condaRepoAccess.js'

declare function setup(condaRepoAccess: ReturnType<typeof createCondaRepoAccess>, testflag?: boolean): Router

export default setup
