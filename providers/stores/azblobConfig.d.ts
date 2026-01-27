// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { AzBlobStoreOptions } from './abstractAzblobStore'
import type { AzBlobDefinitionStore } from './azblobDefinitionStore'
import type { AzHarvestBlobStore } from './azblobHarvestStore'
import type { AzBlobAttachmentStore, AzBlobAttachmentStoreOptions } from './azblobAttachmentStore'

/**
 * Creates an Azure Blob harvest store with the given options or default configuration.
 *
 * @param options - Optional configuration options for the store
 * @returns A new AzHarvestBlobStore instance
 */
export function harvest(options?: AzBlobStoreOptions): AzHarvestBlobStore

/**
 * Creates an Azure Blob definition store with the given options or default configuration.
 *
 * @param options - Optional configuration options for the store
 * @returns A new AzBlobDefinitionStore instance
 */
export function definition(options?: AzBlobStoreOptions): AzBlobDefinitionStore

/**
 * Creates an Azure Blob attachment store with the given options or default configuration.
 *
 * @param options - Optional configuration options for the store
 * @returns A new AzBlobAttachmentStore instance
 */
export function attachment(options?: AzBlobAttachmentStoreOptions): AzBlobAttachmentStore
