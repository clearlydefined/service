const config = require('painless-config');

module.exports = (req, res, next) => {
  if (req.app.locals.config) {
    return next();
  }

  req.app.locals.config = {
    curation: {
      store: {
        github: {
          url: config.get('CLEARLY_DEFINED_CURATION_GITHUB_URL'),
          token: config.get('CLEARLY_DEFINED_CURATION_GITHUB_TOKEN')
        }
      }
    }
  };
  return next();
}