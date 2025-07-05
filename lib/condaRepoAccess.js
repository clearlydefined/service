// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { callFetch: requestPromise } = require('./fetch')
const { uniq } = require('lodash')
const createCache = require('../providers/caching/memory')

/**
 * @typedef {import('./condaRepoAccess').CondaChannels} CondaChannels
 *
 * @typedef {import('./condaRepoAccess').CondaChannelData} CondaChannelData
 *
 * @typedef {import('./condaRepoAccess').CondaRepoData} CondaRepoData
 *
 * @typedef {import('./condaRepoAccess').CondaPackageMatch} CondaPackageMatch
 *
 * @typedef {import('../providers/caching').ICache} ICache
 */

/**
 * Configuration mapping of Conda channel names to their base URLs
 *
 * @type {CondaChannels}
 */
const condaChannels = {
  'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
  'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
  'conda-forge': 'https://conda.anaconda.org/conda-forge'
}

/**
 * Main class for accessing Conda repository data. Provides methods to fetch channel data, repository data, and search
 * for packages.
 */
class CondaRepoAccess {
  /**
   * Creates a new CondaRepoAccess instance
   *
   * @param {ICache} [cache] - Cache instance to use for storing data. Defaults to memory cache with 8 hour TTL if not
   *   provided.
   */
  constructor(cache) {
    this.cache = cache || createCache({ defaultTtlSeconds: 8 * 60 * 60 }) // 8 hours
  }

  /**
   * Validates if a channel is recognized and supported
   *
   * @param {string} channel - Channel name to validate
   * @throws {Error} When channel is not recognized
   */
  checkIfValidChannel(channel) {
    if (!condaChannels[channel]) {
      throw new Error(`Unrecognized Conda channel ${channel}`)
    }
  }

  /**
   * Fetches channel data from cache or network. Channel data contains information about all packages available in a
   * channel.
   *
   * @param {string} channel - Channel name
   * @returns {Promise<CondaChannelData>} Promise resolving to channel data
   * @throws {Error} When channel is invalid or fetch fails
   */
  async fetchChannelData(channel) {
    const key = `${channel}-channelData`
    let channelData = this.cache.get(key)
    if (!channelData) {
      const url = `${condaChannels[channel]}/channeldata.json`
      channelData = await requestPromise({ url, method: 'GET', json: true })
      this.cache.set(key, channelData)
    }
    return channelData
  }

  /**
   * Fetches repository data for a specific channel and subdirectory. Repository data contains detailed package
   * information for a specific platform.
   *
   * @param {string} channel - Channel name
   * @param {string} subdir - Subdirectory name (platform like 'linux-64', 'win-64')
   * @returns {Promise<CondaRepoData>} Promise resolving to repository data
   * @throws {Error} When channel is invalid or fetch fails
   */
  async fetchRepoData(channel, subdir) {
    const key = `${channel}-${subdir}-repoData`
    let repoData = this.cache.get(key)
    if (!repoData) {
      const url = `${condaChannels[channel]}/${subdir}/repodata.json`
      repoData = await requestPromise({ url, method: 'GET', json: true })
      this.cache.set(key, repoData)
    }
    return repoData
  }

  /**
   * Gets all available revisions for a package across specified subdirectories. Each revision represents a specific
   * build of a package version.
   *
   * @param {string} channel - Channel name
   * @param {string} subdir - Subdirectory name or '-' to search all available subdirs
   * @param {string} name - Package name
   * @returns {Promise<string[]>} Promise resolving to array of revision strings in format "subdir:version-build"
   * @throws {Error} When package not found or subdir doesn't exist
   */
  async getRevisions(channel, subdir, name) {
    channel = encodeURIComponent(channel)
    name = encodeURIComponent(name)
    subdir = encodeURIComponent(subdir)
    this.checkIfValidChannel(channel)
    const channelData = await this.fetchChannelData(channel)
    if (!channelData.packages[name]) {
      throw new Error(`Package ${name} not found in channel ${channel}`)
    }
    if (subdir !== '-' && !channelData.subdirs.find(x => x === subdir)) {
      throw new Error(`Subdir ${subdir} is non-existent in channel ${channel}, subdirs: ${channelData.subdirs}`)
    }
    /** @type {string[]} */
    let revisions = []
    const subdirs = subdir === '-' ? channelData.packages[name].subdirs : [subdir]
    for (let subdir of subdirs) {
      const repoData = await this.fetchRepoData(channel, subdir)
      ;['packages', 'packages.conda'].forEach(key => {
        if (repoData[key]) {
          const matchingVersions = Object.entries(repoData[key])
            .filter(([, packageData]) => packageData.name === name)
            .map(([, packageData]) => `${subdir}:${packageData.version}-${packageData.build}`)
          revisions.push(...matchingVersions)
        }
      })
    }
    return uniq(revisions)
  }

  /**
   * Searches for packages by name pattern in the specified channel. Returns packages whose names contain the search
   * term.
   *
   * @param {string} channel - Channel name
   * @param {string} name - Package name pattern to search for
   * @returns {Promise<CondaPackageMatch[]>} Promise resolving to array of matching packages
   * @throws {Error} When channel is invalid or fetch fails
   */
  async getPackages(channel, name) {
    channel = encodeURIComponent(channel)
    name = encodeURIComponent(name)
    this.checkIfValidChannel(channel)
    const channelData = await this.fetchChannelData(channel)
    const matches = Object.entries(channelData.packages)
      .filter(([packageName]) => packageName.includes(name))
      .map(([packageName]) => ({ id: packageName }))
    return matches
  }
}

/**
 * Factory function that creates a new CondaRepoAccess instance
 *
 * @param {ICache} [cache] - Optional cache instance
 * @returns {CondaRepoAccess} New CondaRepoAccess instance
 */
module.exports = cache => new CondaRepoAccess(cache)
