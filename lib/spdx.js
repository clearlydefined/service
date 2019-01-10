// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const spdxExpressionParse = require('spdx-expression-parse')
const spdxSatisfies = require('spdx-satisfies')
const spdxLicenseList = require('spdx-license-list')
const spdxLicenseSet = require('spdx-license-list/simple')
const lowerSpdxLicenseMap = new Map(Array.from(spdxLicenseSet).map(x => [x.toLowerCase(), x]))
const lowerSpdxNameMap = new Map(Object.keys(spdxLicenseList).map(x => [spdxLicenseList[x].name.toLowerCase(), x]))

const NOASSERTION = 'NOASSERTION'

/**
 * turns an expression into an AST and corrects each node
 *
 * @param {string} expression SPDX expression
 * @param {Function} licenseVisitor Optional. Bring your own visitor to clean each node
 * @returns {object} the AST representing the parsed expression
 */
function parse(expression, licenseVisitor) {
  licenseVisitor = licenseVisitor || normalizeSingle
  try {
    return spdxExpressionParse(expression, { relaxed: true, licenseVisitor })
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
 * e.g. mit OR apache-2.0 -> MIT OR Apache-2.0
 *
 * @param {string} expression SPDX expression
 * @returns {string} the SPDX expression
 */
function normalize(expression) {
  if (!expression || !expression.trim()) return null
  return stringify(parse(expression))
}

/**
 * normalizes and returns back a single SPDX identifier
 * e.g. mit -> MIT
 *
 * @param {string} expression SPDX expression
 * @returns {string} the SPDX expression
 */
function normalizeSingle(license) {
  if (!license) return null
  return lowerSpdxLicenseMap.get(license.toLowerCase().trim()) || null
}

/**
 * Checks if 2 spdx expressions are compatibile
 *
 * @param {string} expression1 SPDX expression 1
 * @param {string} expression2 SPDX expression 2
 * @returns {boolean} true if the licenses are compatible
 */
function satisfies(expression1, expression2) {
  return spdxSatisfies(expression1, expression2, { parse })
}

/**
 * given the full name of a license return the SPDX identifier
 * Example: Common Public License 1.0 -> CPL-1.0
 * Case insensitive
 *
 * @param {string} licenseName
 * @returns {string} SPDX identifer
 */
function lookupByName(licenseName) {
  if (!licenseName) return null
  return lowerSpdxNameMap.get(licenseName.toLowerCase().trim()) || null
}

module.exports = { parse, stringify, normalize, normalizeSingle, satisfies, lookupByName }
