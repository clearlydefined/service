// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { Logger } from '../providers/logging/index.js'

declare function setup(service: any, appLogger?: Logger): Router
export default setup
