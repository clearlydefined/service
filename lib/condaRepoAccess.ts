// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import lodash from 'lodash'
import type { ICache } from '../providers/caching/index.js'
import { callFetch as requestPromise } from './fetch.ts'

const { uniq } = lodash

import createCache from '../providers/caching/memory.js'

/** Configuration mapping of Conda channel names to their base URLs */
export interface CondaChannels {
  'anaconda-main': string
  'anaconda-r': string
  'conda-forge': string
  [key: string]: string
}

/** Package information from Conda channel data */
export interface CondaPackageInfo {
  name?: string
  version?: string
  build?: string
  subdirs?: string[]
}

/** Channel data structure returned by Conda API */
export interface CondaChannelData {
  packages: Record<string, CondaPackageInfo>
  subdirs: string[]
}

/** Repository data structure for a specific platform */
export interface CondaRepoData {
  packages?: Record<string, CondaPackageInfo>
  'packages.conda'?: Record<string, CondaPackageInfo>
  [key: string]: any
}

/** Package search result */
export interface CondaPackageMatch {
  id: string
}

/**
 * Configuration mapping of Conda channel names to their base URLs
 */
const condaChannels: CondaChannels = {
  'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
  'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
  'conda-forge': 'https://conda.anaconda.org/conda-forge'
}

/**
 * Main class for accessing Conda repository data. Provides methods to fetch channel data, repository data, and search
 * for packages.
 */
class CondaRepoAccess {
  cache: ICache

  /**
   * Creates a new CondaRepoAccess instance
   */
  constructor(cache?: ICache) {
    this.cache = cache || createCache({ defaultTtlSeconds: 8 * 60 * 60 }) // 8 hours
  }

  /**
   * Validates if a channel is recognized and supported
   */
  checkIfValidChannel(channel: string): void {
    if (!condaChannels[channel]) {
      throw new Error(`Unrecognized Conda channel ${channel}`)
    }
  }

  /**
   * Fetches channel data from cache or network.
   */
  async fetchChannelData(channel: string): Promise<CondaChannelData> {
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
   * Fetches repository data for a specific channel and subdirectory.
   */
  async fetchRepoData(channel: string, subdir: string): Promise<CondaRepoData> {
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
   * Gets all available revisions for a package across specified subdirectories.
   */
  async getRevisions(channel: string, subdir: string, name: string): Promise<string[]> {
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
    const revisions: string[] = []
    const subdirs = subdir === '-' ? channelData.packages[name]!.subdirs! : [subdir]
    for (const subdir of subdirs) {
      const repoData = await this.fetchRepoData(channel, subdir)
      for (const key of ['packages', 'packages.conda']) {
        if (repoData[key]) {
          const matchingVersions = Object.entries(repoData[key]!)
            .filter(([, packageData]) => (packageData as CondaPackageInfo).name === name)
            .map(
              ([, packageData]) =>
                `${subdir}:${(packageData as CondaPackageInfo).version}-${(packageData as CondaPackageInfo).build}`
            )
          revisions.push(...matchingVersions)
        }
      }
    }
    return uniq(revisions)
  }

  /**
   * Searches for packages by name pattern in the specified channel.
   */
  async getPackages(channel: string, name: string): Promise<CondaPackageMatch[]> {
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
 */
export default (cache?: ICache) => new CondaRepoAccess(cache)
