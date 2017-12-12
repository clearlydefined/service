const GitHubApi = require('github');
const yaml = require('js-yaml');
const _ = require('underscore');
const base64 = require('base-64');

class CurationService {
  constructor(options) {
    this.config = options.config;
  }
  addOrUpdate(requestId, packageFormat, origin, packageName, packageVersion, curationPatch) {
    const github = new GitHubApi({
      headers: {
        'user-agent': 'clearlydefined.io'
      }
    });
    github.authenticate({
      type: 'token',
      token: this.config.curation.store.github.token
    });
    
    const owner = this.config.curation.store.github.owner;
    const repo = this.config.curation.store.github.repo;
    const branch = this.config.curation.store.github.branch;
    const curationPath = `${packageFormat.toLowerCase()}/${origin.toLowerCase()}/${packageName}.yaml`;
    let curationPathSha = null;
    
    return github.repos.getContent({
        owner: owner,
        repo: repo,
        path: curationPath
    })
    .then(content => {
      curationPathSha = content.data.sha;      
      return yaml.safeLoad(base64.decode(content.data.content));
    })
    .catch(err => {
      // TODO: This isn't very safe how it is because any failure will return an empty object,
      // ideally we only do this if the .yaml file doesn't exist.
      return {};
    })
    .then(parsedContent => {
      parsedContent[packageVersion] = _.assign(parsedContent[packageVersion] || {}, curationPatch);
      const updatedPatch = yaml.safeDump(parsedContent);
      return updatedPatch;
    })
    .then(updatedPatch => {
      return github.repos.getBranch({
        owner: owner,
        repo: repo,
        branch: branch
      }).then(masterBranch => {
        return github.gitdata.createReference({
          owner: owner,
          repo: repo,
          ref: `refs/heads/${requestId}`,
          sha: masterBranch.data.commit.sha
        })  
      })
      .then(ref => {
        return [ref, updatedPatch];
      });
    })
    .then(destination => {
      if (curationPathSha) {
        return github.repos.updateFile({
          owner: owner,
          repo: repo,
          path: curationPath,
          message: requestId,
          content: base64.encode(destination[1]),
          branch: requestId,
          sha: curationPathSha
        });
      } else {
        return github.repos.createFile({
          owner: owner,
          repo: repo,
          path: curationPath,
          message: requestId,
          content: base64.encode(destination[1]),
          branch: requestId
        });
      }
      return destination;
    })
    .then(destination => {
      return github.pullRequests.create({
        owner: owner,
        repo: repo,
        title: requestId,
        head: `refs/heads/${requestId}`,
        base: branch
      })
    });
  }
}

module.exports = {
  CurationService: CurationService
};