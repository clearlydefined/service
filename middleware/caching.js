// SPDX-License-Identifier: MIT

module.exports = (cacheProvider) => (req, res, next) => {
  req.app.locals.cache = cacheProvider;
  next();
};
