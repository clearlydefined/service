// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'

declare function setup(harvester: any, store: any, summarizer: any, throttler: any, testFlag?: boolean): Router
export = setup
