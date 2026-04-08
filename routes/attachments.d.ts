// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { AttachmentStore } from '../business/noticeService.js'

declare function setup(attachment: AttachmentStore): Router

export default setup
