const { Gitlab } = require('@gitbeaker/node')

module.exports = {
  getClient: function (options) {
    const gitlab = new Gitlab({
      headers: { 'user-agent': 'clearlydefined.io ' },
      token: options.token
    })
    return gitlab
  }
}