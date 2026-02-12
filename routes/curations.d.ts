// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { Logger } from '../providers/logging'

declare function setup(service: any, appLogger?: Logger): Router
export = setup
