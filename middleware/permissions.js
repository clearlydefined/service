// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT

/**
 * Middleware that checks for team membership.
 *
 * Usage: `app.get('/some/route', teamCheck('harvesters'), (req, res) => ...)`
 */
function permissionCheck(permission) {
  return (req, res, next) => {
    const userTeams = req.app.locals.user.github.teams;
    const requiredTeams = req.app.locals.config.auth.github.permissions[permission]; // whew!
    const intersection = requiredTeams.filter(t => userTeams.includes(t));
    if (requiredTeams.length === 0 || intersection.length > 0) {
      next();
    } else {
      const err = new Error(`No permission to '${permission}' (needs team membership)`);
      err.status = 401;
      next(err);
    }
  };
}

module.exports = {
  permissionCheck
};
