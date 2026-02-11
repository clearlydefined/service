// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { StatusService } from '../business/statusService'

declare function setup(service: StatusService): Router

export = setup
