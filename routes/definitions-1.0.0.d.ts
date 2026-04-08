// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { DefinitionService } from '../business/definitionService.js'

declare function setup(definition: DefinitionService, testFlag?: boolean): Router
export default setup
