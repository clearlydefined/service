// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const vsts = require('vso-node-api');

class Vsts {

  constructor(options) {
    this.options = options;
    const token = options.authToken;
    // TODO commenting out this check for now to simplify non-VSTS based development.
    // ultimately we want to defer provider instantiation until the instance is actually needed.
    // if (!token) {
    //   throw new Error('Auth token unspecified!');
    // }
    const collectionUrl = options.collectionUrl;
    const authHandler = vsts.getPersonalAccessTokenHandler(token);
    const connection = new vsts.WebApi(collectionUrl, authHandler);
    this.project = options.projectName;
    this.vstsBuild = connection.getBuildApi();
    this.buildDefinitionName = options.buildDefinitionName;
    this.buildVariableName = options.buildVariableName;
  }

  harvest(spec) {
    return this.vstsBuild.getDefinitions(this.project, this.buildDefinitionName).then(definitions => {
      if (!definitions[0] || !definitions[0].id) {
        return Promise.reject(new Error('Build definition does not exist.'));
      }
      const build = {
        definition: {
          id: definitions[0].id
        },
        parameters: JSON.stringify({ [this.buildVariableName]: JSON.stringify(spec) })
      };
      return this.vstsBuild.queueBuild(build, this.project);
    });
  }
}

module.exports = options => new Vsts(options);