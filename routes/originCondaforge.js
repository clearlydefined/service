const express = require('express')
const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = express.Router()

function setup(repoAccess) {
  const channel = 'conda-forge'
  router.get(
    '/:subdir/:name/revisions',
    asyncMiddleware(async (req, res) => {
      const { name, subdir } = req.params
      try {
        const revisions = await repoAccess.getRevisions(channel, encodeURIComponent(subdir), encodeURIComponent(name))
        res.status(200).send(revisions)
      } catch (error) {
        res.status(404).send(error.message)
      }
    })
  )

  router.get(
    '/:name',
    asyncMiddleware(async (req, res) => {
      const { name } = req.params
      try {
        const matches = await repoAccess.getPackages(channel, encodeURIComponent(name))
        res.status(200).send(matches)
      } catch (error) {
        res.status(404).send(error.message)
      }
    })
  )

  return router
}

module.exports = setup
