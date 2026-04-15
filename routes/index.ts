// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Request, Response, Router } from 'express'

import express from 'express'

const router = express.Router()

router.get('/', (_req: Request, res: Response) => {
  const msg = `{ "status": "OK", "version": "${version}", "sha": "${sha}" }`
  res.status(200).send(msg)
})

let version: string
let sha: string

function setup(buildsha: string, appVersion: string): Router {
  version = appVersion
  sha = buildsha
  return router
}
export default setup
