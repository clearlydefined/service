// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { NoticeService } from '../business/noticeService.js'

declare function setup(notice: NoticeService): Router

export default setup
