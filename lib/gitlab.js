const { Gitlab } = require('@gitbeaker/node')
const { defaultHeaders } = require('./fetch')

module.exports = {
  getClient: function (options) {
    const gitlab = new Gitlab({
      headers: defaultHeaders,
      token: options?.token
    })
    return gitlab
  }
}
