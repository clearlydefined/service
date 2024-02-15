// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const { uniq } = require('lodash')
const { Cache } = require('memory-cache')
const condaChannels = {
  'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
  'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
  'conda-forge': 'https://conda.anaconda.org/conda-forge'
}
const condaCache = new Cache()

async function fetchCondaChannelData(channel) {
  const key = `${channel}-channelData`
  let channelData = condaCache.get(key)
  if (!channelData) {
    const url = `${condaChannels[channel]}/channeldata.json`
    channelData = await requestPromise({ url, method: 'GET', json: true })
    condaCache.put(key, channelData, 8 * 60 * 60 * 1000) // 8 hours
  }
  return channelData
}

async function fetchCondaRepoData(channel, subdir) {
  const key = `${channel}-${subdir}-repoData`
  let repoData = condaCache.get(key)
  if (!repoData) {
    const url = `${condaChannels[channel]}/${subdir}/repodata.json`
    repoData = await requestPromise({ url, method: 'GET', json: true })
    condaCache.put(key, repoData, 8 * 60 * 60 * 1000) // 8 hours
  }
  return repoData
}

router.get(
  '/:channel/:subdir/:name/revisions',
  asyncMiddleware(async (request, response) => {
    const { channel, subdir, name } = request.params
    if (!condaChannels[channel]) {
      return response.status(404).send(`Unrecognized Conda channel ${channel}`)
    }
    let channelData = await fetchCondaChannelData(channel)
    if (!channelData.packages[name]) {
      return response.status(404).send(`Package ${name} not found in Conda channel ${channel}`)
    }
    if (subdir !== '-' && !channelData.subdirs.find(x => x == subdir)) {
      return response.status(404).send(`Subdir ${subdir} is non-existent in Conda channel ${channel}`)
    }
    let revisions = []
    let subdirs = subdir === '-' ? channelData.packages[name].subdirs : [subdir]
    for (let subdir of subdirs) {
      const repoData = await fetchCondaRepoData(channel, subdir)
      if (repoData['packages']) {
        Object.entries(repoData['packages'])
          .forEach(([, packageData]) => {
            if (packageData.name === name) {
              revisions.push(`${subdir}:${packageData.version}-${packageData.build}`)
            }
          })
      }
      if (repoData['packages.conda']) {
        Object.entries(repoData['packages.conda'])
          .forEach(([, packageData]) => {
            if (packageData.name === name) {
              revisions.push(`${subdir}:${packageData.version}-${packageData.build}`)
            }
          })
      }
    }
    return response.status(200).send(uniq(revisions))
  })
)

router.get(
  '/:channel/:name',
  asyncMiddleware(async (request, response) => {
    const { channel, name } = request.params
    if (!condaChannels[channel]) {
      return response.status(404).send([])
    }
    let channelData = await fetchCondaChannelData(channel)
    let matches = Object.entries(channelData.packages).filter(([packageName,]) => packageName.includes(name)).map(
      ([packageName,]) => { return { id: packageName } }
    )
    return response.status(200).send(matches)
  })
)

function setup() {
  return router
}

module.exports = setup