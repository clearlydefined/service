// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { EntityCoordinates } from '../../lib/entityCoordinates'
import type { ResultCoordinates, ResultCoordinatesSpec } from '../../lib/resultCoordinates'
import type { Logger } from '../logging'

/** Options for configuring an AbstractFileStore */
export interface FileStoreOptions {
  /** Base directory location for file storage */
  location: string
  /** Optional logger instance */
  logger?: Logger
}

/** Query parameters for finding definitions */
export interface FileStoreQuery {
  /** Filter by component type */
  type?: string
  /** Filter by provider */
  provider?: string
  /** Filter by namespace */
  namespace?: string
  /** Filter by name */
  name?: string
  /** Filter by declared license */
  license?: string
  /** Filter by release date (after) */
  releasedAfter?: string
  /** Filter by release date (before) */
  releasedBefore?: string
  /** Filter by minimum licensed score */
  minLicensedScore?: number
  /** Filter by maximum licensed score */
  maxLicensedScore?: number
  /** Filter by minimum described score */
  minDescribedScore?: number
  /** Filter by maximum described score */
  maxDescribedScore?: number
}

/** Visitor function type for list operations */
export type FileStoreVisitor<T> = (data: any) => T | null

/**
 * Abstract base class for file-based storage implementations.
 * Provides common functionality for reading and writing JSON files to disk.
 */
declare class AbstractFileStore {
  /** Configuration options for the store */
  protected options: FileStoreOptions

  /** Logger instance for the store */
  protected logger: Logger

  /**
   * Creates a new AbstractFileStore instance
   *
   * @param options - Configuration options for the store
   */
  constructor(options?: FileStoreOptions)

  /**
   * Initializes the store (no-op for file stores)
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>

  /**
   * Visit all of the files associated with the given coordinates.
   *
   * @param coordinates - Accepts partial coordinates
   * @param visitor - Function to apply to each file's parsed JSON content
   * @returns The collection of results returned by the visitor
   */
  list<T>(coordinates: EntityCoordinates | ResultCoordinates, visitor: FileStoreVisitor<T>): Promise<T[]>

  /**
   * Get and return the object at the given coordinates.
   *
   * @param coordinates - The coordinates of the object to get
   * @returns The loaded object or null if not found
   */
  get(coordinates: EntityCoordinates | ResultCoordinates): Promise<any>

  /**
   * Query and return the objects based on the query
   *
   * @param query - The filters for the request
   * @returns Array of matching definitions
   */
  find(query: FileStoreQuery): Promise<any[]>

  /**
   * Validates if a storage path represents valid coordinates
   *
   * @param entry - The path to validate
   * @returns True if the path represents valid coordinates
   */
  protected _isValidPath(entry: string): boolean

  /**
   * Converts coordinates to a storage path
   *
   * @param coordinates - The coordinates to convert
   * @returns The storage path
   */
  protected _toStoragePathFromCoordinates(coordinates: EntityCoordinates | ResultCoordinates): string

  /**
   * Converts a storage path to ResultCoordinates
   *
   * @param path - The storage path to convert
   * @returns The ResultCoordinates
   */
  protected _toResultCoordinatesFromStoragePath(path: string): ResultCoordinates

  /**
   * Checks if coordinates represent an interesting/valid component type
   *
   * @param coordinates - The coordinates to check
   * @returns True if the coordinates are interesting
   */
  static isInterestingCoordinates(coordinates: ResultCoordinates): boolean

  /**
   * Converts a storage path to ResultCoordinates
   *
   * @param path - The storage path to convert
   * @returns The ResultCoordinates
   */
  static toResultCoordinatesFromStoragePath(path: string): ResultCoordinates

  /**
   * Trims a storage path to extract coordinate components
   *
   * @param path - The storage path to trim
   * @returns The trimmed path string
   */
  static trimStoragePath(path: string): string

  /**
   * Converts coordinates to a storage path
   *
   * @param coordinates - The coordinates to convert
   * @returns The storage path string
   */
  static toStoragePathFromCoordinates(
    coordinates: EntityCoordinates | ResultCoordinates | ResultCoordinatesSpec
  ): string

  /**
   * Gets the latest tool version paths from a list of paths
   *
   * @param paths - Array of paths to process
   * @param toResultCoordinates - Optional function to convert paths to coordinates
   * @returns Set of paths representing the latest tool versions
   */
  static getLatestToolPaths(paths: string[], toResultCoordinates?: (path: string) => ResultCoordinates): Set<string>
}

export = AbstractFileStore
