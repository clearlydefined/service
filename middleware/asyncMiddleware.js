// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

module.exports = func =>
  (request, response, next) => Promise.resolve(func(request, response, next)).catch(next);
