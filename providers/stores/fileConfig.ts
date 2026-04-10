// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import config from 'painless-config'
import type { FileStoreOptions } from './abstractFileStore.ts'
import type { FileAttachmentStoreOptions } from './fileAttachmentStore.ts'
import fileAttachmentStore from './fileAttachmentStore.ts'
import fileDefinitionStore from './fileDefinitionStore.ts'
import fileHarvestStore from './fileHarvestStore.ts'

const location = config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')

/**
 * Creates a file-based harvest store with the given options or default configuration.
 */
function harvest(options?: FileStoreOptions) {
  return fileHarvestStore(options || { location })
}

/**
 * Creates a file-based definition store with the given options or default configuration.
 */
function definition(options?: FileStoreOptions) {
  return fileDefinitionStore(options || { location: `${location}-definition` })
}

/**
 * Creates a file-based attachment store with the given options or default configuration.
 */
function attachment(options?: FileAttachmentStoreOptions) {
  return fileAttachmentStore(options || { location: `${location}-attachment` })
}

export default { harvest, definition, attachment }
