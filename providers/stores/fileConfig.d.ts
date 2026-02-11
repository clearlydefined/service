// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { FileStoreOptions } from './abstractFileStore'
import type { FileDefinitionStore } from './fileDefinitionStore'
import type { FileHarvestStore } from './fileHarvestStore'
import type { FileAttachmentStore, FileAttachmentStoreOptions } from './fileAttachmentStore'

/**
 * Creates a file-based harvest store with the given options or default configuration.
 *
 * @param options - Optional configuration options for the store
 * @returns A new FileHarvestStore instance
 */
export function harvest(options?: FileStoreOptions): FileHarvestStore

/**
 * Creates a file-based definition store with the given options or default configuration.
 *
 * @param options - Optional configuration options for the store
 * @returns A new FileDefinitionStore instance
 */
export function definition(options?: FileStoreOptions): FileDefinitionStore

/**
 * Creates a file-based attachment store with the given options or default configuration.
 *
 * @param options - Optional configuration options for the store
 * @returns A new FileAttachmentStore instance
 */
export function attachment(options?: FileAttachmentStoreOptions): FileAttachmentStore
