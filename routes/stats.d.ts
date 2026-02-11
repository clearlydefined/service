// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { StatsService } from '../business/statsService'

declare function setup(stats: StatsService): Router

export = setup
