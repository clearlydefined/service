// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const requestPromise = require('request-promise-native')
const { uniq } = require('lodash')
const condaChannels = {
  'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
  'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
  'conda-forge': 'https://conda.anaconda.org/conda-forge'
}

router.get(
  '/:name/:channel/revisions',
  asyncMiddleware(async (request, response) => {
    const { name, channel } = request.params
    if (!condaChannels[channel]) {
      return response.status(404).send([])
    }
    const url = `${condaChannels[channel]}/channeldata.json`
    const channelData = await requestPromise({ url, method: 'GET', json: true })
    if (channelData.packages[name]) {
      let revisions = []
      for (let subdir of channelData.packages[name].subdirs) {
        const repoUrl = `${condaChannels[channel]}/${subdir}/repodata.json`
        const repoData = await requestPromise({ url: repoUrl, method: 'GET', json: true })
        if (repoData['packages']) {
          Object.entries(repoData['packages'])
            .forEach(([, packageData]) => {
              if (packageData.name == name) {
                revisions.push(`${subdir}--${packageData.version}-${packageData.build}`)
              }
            })
        }
        if (repoData['packages.conda']) {
          Object.entries(repoData['packages.conda'])
            .forEach(([, packageData]) => {
              if (packageData.name == name) {
                revisions.push(`${subdir}--${packageData.version}-${packageData.build}`)
              }
            })
        }
      }
      return response.status(200).send(uniq(revisions))
    } else {
      return response.status(404).send([])
    }
  })
)

router.get(
  '/:name/:channel',
  asyncMiddleware(async (request, response) => {
    const { name, channel } = request.params
    if (!condaChannels[channel]) {
      return response.status(404).send([])
    }
    const url = `${condaChannels[channel]}/channeldata.json`
    const channelData = await requestPromise({ url, method: 'GET', json: true })
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