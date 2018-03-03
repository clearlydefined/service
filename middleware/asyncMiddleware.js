// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

module.exports = func => (request, response, next) => Promise.resolve(func(request, response, next)).catch(next)
