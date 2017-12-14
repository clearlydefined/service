const GitHubApi = require('github');

module.exports = {
  getClient: function (options) {
    const github = new GitHubApi({
      headers: {
        'user-agent': 'clearlydefined.io'
      }
    });
    github.authenticate({
      type: 'token',
      token: options.token
    });
    return github;
  }
}
