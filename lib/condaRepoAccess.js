// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { callFetch: requestPromise } = require('./fetch')
const { uniq } = require('lodash')
const Cache = require('../providers/caching/memory')

const condaChannels = {
  'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
  'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
  'conda-forge': 'https://conda.anaconda.org/conda-forge'
}

class CondaRepoAccess {
  constructor(cache) {
    this.cache = cache || Cache({ defaultTtlSeconds: 8 * 60 * 60 }) // 8 hours
  }

  checkIfValidChannel(channel) {
    if (!condaChannels[channel]) {
      throw new Error(`Unrecognized Conda channel ${channel}`)
    }
  }

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

module.exports = cache => new CondaRepoAccess(cache)
