// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT
const config = require('../../lib/config');
const vsts = require('vso-node-api');

class VstsOrt {

  constructor(options) {
    this.options = options;
    this.build = new Build();
  }

  harvest(spec) {
    return this.build.queueBuild(spec);
  }
}

class Build {
  constructor() {
    const token = config.harvest.harvester.vstsOrt.authToken;
    if (!token) {
      throw new Error('Auth token unspecified!');
    }
    const collectionUrl = config.harvest.harvester.vstsOrt.collectionUrl;
    const authHandler = vsts.getPersonalAccessTokenHandler(token);
    const connection = new vsts.WebApi(collectionUrl, authHandler);
    this.project = config.harvest.harvester.vstsOrt.projectName;
    this.vstsBuild = connection.getBuildApi();
    this.buildDefinitionName = config.harvest.harvester.vstsOrt.buildDefinitionName;
    this.buildVariableName = config.harvest.harvester.vstsOrt.buildVariableName;
  }

  queueBuild(spec) {
    const self = this;
    return this.vstsBuild.getDefinitions(self.project, self.buildDefinitionName).then(definitions => {
      if (!definitions[0] || !definitions[0].id) {
        return Promise.reject(new Error('Build definition does not exist.'));
      }
      const build = {
        definition: {
          id: definitions[0].id
        },
        parameters: JSON.stringify({ [self.buildVariableName]: JSON.stringify(spec) })
      };
      return this.vstsBuild.queueBuild(build, self.project);
    });
  }
}

module.exports = (options) => new VstsOrt(options);