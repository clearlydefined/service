// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import type { AttachmentStore } from '../business/noticeService'

declare function setup(attachment: AttachmentStore): Router

export = setup
