// Copyright (c) The Linux Foundation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { DefinitionService } from '../business/definitionService'
import type { Logger } from '../providers/logging'

declare function setup(
  curation: any,
  definition: DefinitionService,
  appLogger: Logger,
  githubToken: string,
  crawlerToken: string,
  testFlag?: boolean
): Router
export = setup
