// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { SuggestionService } from '../business/suggestionService'

declare function setup(service: SuggestionService): Router

export = setup
