// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { ICache } from '../providers/caching'

/** Configuration mapping of Conda channel names to their base URLs */
export interface CondaChannels {
  'anaconda-main': string
  'anaconda-r': string
  'conda-forge': string
  [key: string]: string
}

/** Package information from Conda channel data */
export interface CondaPackageInfo {
  /** Package name */
  name?: string
  /** Package version */
  version?: string
  /** Build string */
  build?: string
  /** Available subdirectories for this package */
  subdirs?: string[]
}

/** Channel data structure returned by Conda API */
export interface CondaChannelData {
  /** Map of package names to their information */
  packages: Record<string, CondaPackageInfo>
  /** Available subdirectories in this channel */
  subdirs: string[]
}

/** Repository data structure for a specific platform */
export interface CondaRepoData {
  /** Standard packages */
  packages?: Record<string, CondaPackageInfo>
  /** Conda format packages */
  'packages.conda'?: Record<string, CondaPackageInfo>
  [key: string]: any
}

/** Package search result */
export interface CondaPackageMatch {
  /** Package identifier */
  id: string
}

/** Main class for accessing Conda repository data */
declare class CondaRepoAccess {
  /** Cache instance for storing fetched data */
  private cache: ICache

  /**
   * Creates a new CondaRepoAccess instance
   *
   * @param cache - Cache instance to use for storing data
   */
  constructor(cache?: ICache)

  /**
   * Validates if a channel is recognized and supported
   *
   * @param channel - Channel name to validate
   * @throws {Error} When channel is not recognized
   */
  checkIfValidChannel(channel: string): void

  /**
   * Fetches channel data from cache or network
   *
   * @param channel - Channel name
   * @returns Promise resolving to channel data
   * @throws {Error} When channel is invalid or fetch fails
   */
  fetchChannelData(channel: string): Promise<CondaChannelData>

  /**
   * Fetches repository data for a specific channel and subdirectory
   *
   * @param channel - Channel name
   * @param subdir - Subdirectory name (platform)
   * @returns Promise resolving to repository data
   * @throws {Error} When channel is invalid or fetch fails
   */
  fetchRepoData(channel: string, subdir: string): Promise<CondaRepoData>

  /**
   * Gets all available revisions for a package
   *
   * @example
   *   ```javascript
   *   const revisions = await condaAccess.getRevisions('conda-forge', 'linux-64', 'numpy')
   *   // Returns: ['linux-64:1.21.0-py39h0']
   *   ```
   *
   * @param channel - Channel name
   * @param subdir - Subdirectory name or '-' for all subdirs
   * @param name - Package name
   * @returns Promise resolving to array of revision strings in format "subdir:version-build"
   * @throws {Error} When package not found or subdir doesn't exist
   */
  getRevisions(channel: string, subdir: string, name: string): Promise<string[]>

  /**
   * Searches for packages by name pattern
   *
   * @example
   *   ```javascript
   *   const packages = await condaAccess.getPackages('conda-forge', 'numpy')
   *   // Returns: [{ id: 'numpy' }, { id: 'numpy-base' }]
   *   ```
   *
   * @param channel - Channel name
   * @param name - Package name pattern to search for
   * @returns Promise resolving to array of matching packages
   * @throws {Error} When channel is invalid or fetch fails
   */
  getPackages(channel: string, name: string): Promise<CondaPackageMatch[]>
}

/**
 * Factory function that creates a new CondaRepoAccess instance
 *
 * @param cache - Optional cache instance
 * @returns New CondaRepoAccess instance
 */
declare function createCondaRepoAccess(cache?: ICache): CondaRepoAccess

export = createCondaRepoAccess
