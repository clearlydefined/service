// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const spdxExpressionParse = require('spdx-expression-parse')
const spdxSatisfies = require('spdx-satisfies')
const spdxLicenseSet = require('spdx-license-list/simple')
const lowerSpdxLicenseMap = new Map(Array.from(spdxLicenseSet).map(x => [x.toLowerCase(), x]))
const NOASSERTION = 'NOASSERTION'

function parse(expression) {
  try {
    return spdxExpressionParse(expression, { relaxed: true, licenseVisitor: _licenseVisitor })
  } catch (e) {
    return { noassertion: true }
  }
}

function stringify(obj) {
  if (obj.hasOwnProperty('noassertion')) return NOASSERTION
  if (obj.license) {
    return obj.exception ? `${obj.license} WITH ${obj.exception}` : obj.license
  }
  const left = obj.left.conjunction ? `(${stringify(obj.left)})` : stringify(obj.left)
  const right = obj.right.conjunction ? `(${stringify(obj.right)})` : stringify(obj.right)
  return `${left} ${obj.conjunction.toUpperCase()} ${right}`
}

function normalize(expression) {
  if (!expression) return null
  const result = stringify(parse(expression))
  return result !== NOASSERTION ? result : null
}

function satisfies(expression1, expression2) {
  return spdxSatisfies(expression1, expression2, { parse })
}

function _licenseVisitor(license) {
  if (!license) return null
  return lowerSpdxLicenseMap.get(license.toLowerCase().trim()) || null
}

module.exports = { parse, stringify, normalize, satisfies }
