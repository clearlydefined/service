// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const config = require('painless-config');

module.exports = (req, res, next) => {
  if (req.app.locals.config) {
    return next();
  }

  req.app.locals.config = {
    curation: {
      store: {
        github: {
          owner: config.get('CLEARLY_DEFINED_CURATION_GITHUB_OWNER'),
          repo: config.get('CLEARLY_DEFINED_CURATION_GITHUB_REPO'),
          branch: config.get('CLEARLY_DEFINED_CURATION_GITHUB_BRANCH'),
          token: config.get('CLEARLY_DEFINED_CURATION_GITHUB_TOKEN')
        }
      }
    }
  };
  return next();
}
