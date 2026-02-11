// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Writable } from 'stream'
import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { ResultCoordinates } from '../../lib/resultCoordinates'
import type { FileStoreOptions } from './abstractFileStore'
import AbstractFileStore = require('./abstractFileStore')

/** Tool output results organized by tool name and version */
export interface ToolOutputs {
  [toolName: string]: {
    [toolVersion: string]: any
  }
}

/**
 * File system implementation for storing harvest results.
 * Extends AbstractFileStore with harvest-specific functionality.
 */
declare class FileHarvestStore extends AbstractFileStore {
  /**
   * List all of the results for the given coordinates.
   *
   * @param coordinates - Accepts partial coordinates
   * @returns A list of matching coordinates i.e. [ 'npm/npmjs/-/JSONStream/1.3.3/tool/scancode/2.9.2' ]
   */
  list(coordinates: EntityCoordinates | ResultCoordinates): Promise<string[]>

  /**
   * Stream the content identified by the coordinates onto the given stream and close the stream.
   *
   * @param coordinates - The coordinates of the content to access
   * @param stream - The stream onto which the output is written
   * @returns Promise that resolves when streaming is complete
   */
  stream(coordinates: ResultCoordinates, stream: Writable): Promise<null>

  /**
   * Get all of the tool outputs for the given coordinates.
   * The coordinates must be all the way down to a revision.
   *
   * @param coordinates - The component revision to report on
   * @returns An object with a property for each tool and tool version
   */
  getAll(coordinates: EntityCoordinates): Promise<ToolOutputs>

  /**
   * Get the latest version of each tool output for the given coordinates.
   * The coordinates must be all the way down to a revision.
   *
   * @param coordinates - The component revision to report on
   * @returns A promise that resolves to an object with a property for each tool and tool version
   */
  getAllLatest(coordinates: EntityCoordinates): Promise<ToolOutputs>
}

/**
 * Factory function to create a FileHarvestStore instance.
 *
 * @param options - Configuration options for the store
 * @returns A new FileHarvestStore instance
 */
declare function createFileHarvestStore(options?: FileStoreOptions): FileHarvestStore

export = createFileHarvestStore
