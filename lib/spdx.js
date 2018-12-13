// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const spdxExpressionParse = require('spdx-expression-parse')
const spdxSatisfies = require('spdx-satisfies')
const spdxLicenseSet = require('spdx-license-list/simple')
const lowerSpdxLicenseMap = new Map(Array.from(spdxLicenseSet).map(x => [x.toLowerCase(), x]))
const NOASSERTION = 'NOASSERTION'

/**
 * turns an expression into an AST and corrects each node
 *
 * @param {string} expression SPDX expression
 * @returns {object} the AST representing the parsed expression
 */
function parse(expression) {
  try {
    return spdxExpressionParse(expression, { relaxed: true, licenseVisitor: _licenseVisitor })
  } catch (e) {
    return { noassertion: true }
  }
}

/**
 * turns a parsed expression AST into an SPDX expression
 *
 * @param {object} obj an AST representing the parsed expression
 * @returns {string} the SPDX expression
 */
function stringify(obj) {
  if (obj.hasOwnProperty('noassertion')) return NOASSERTION
  if (obj.license) return `${obj.license}${obj.plus ? '+' : ''}${obj.exception ? ` WITH ${obj.exception}` : ''}`
  const left = obj.left.conjunction === 'or' ? `(${stringify(obj.left)})` : stringify(obj.left)
  const right = obj.right.conjunction === 'or' ? `(${stringify(obj.right)})` : stringify(obj.right)
  return `${left} ${obj.conjunction.toUpperCase()} ${right}`
}

/**
 * normalizes and returns back a given SPDX expression
 *
 * @param {string} expression SPDX expression
 * @returns {string} the SPDX expression
 */
function normalize(expression) {
  if (!expression || !expression.trim()) return null
  return stringify(parse(expression))
}

/**
 * normalizes and returns back a given SPDX expression
 *
 * @param {string} expression1 SPDX expression 1
 * @param {string} expression2 SPDX expression 2
 * @returns {boolean} true if the licenses are compatible
 */
function satisfies(expression1, expression2) {
  return spdxSatisfies(expression1, expression2, { parse })
}

function _licenseVisitor(license) {
  if (!license) return null
  return lowerSpdxLicenseMap.get(license.toLowerCase().trim()) || null
}

module.exports = { parse, stringify, normalize, satisfies }
