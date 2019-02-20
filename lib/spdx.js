// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const spdxExpressionParse = require('spdx-expression-parse')
const spdxSatisfies = require('spdx-satisfies')
const spdxLicenseList = require('spdx-license-list')
const spdxLicenseSet = require('spdx-license-list/simple')
const lowerSpdxLicenseMap = new Map(Array.from(spdxLicenseSet).map(x => [x.toLowerCase(), x]))
const lowerSpdxNameMap = new Map(Object.keys(spdxLicenseList).map(x => [spdxLicenseList[x].name.toLowerCase(), x]))
const { uniq, uniqWith, isEqual } = require('lodash')

const NOASSERTION = 'NOASSERTION'

/**
 * turns an expression into an AST and corrects each node
 *
 * @param {string} expression SPDX expression
 * @param {Function} licenseVisitor Optional. Bring your own visitor to clean each node
 * @returns {object} the AST representing the parsed expression
 */
function parse(expression, licenseVisitor) {
  // if the expression is already an expression, just return it.
  if (!(typeof expression === 'string')) return expression
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
 * Checks if the first expression satisfies the second arg
 *
 * @param {string} expression1 SPDX expression 1
 * @param {string} expression2 SPDX expression 2
 * @returns {boolean} true if `expression1` satisfies `expression2`
 */
function satisfies(expression1, expression2) {
  // const one = _stringifyOrAnds(expandExpression(expression1))
  // const two = _stringifyOrAnds(expandExpression(expression2))
  return spdxSatisfies(expression1, expression2, { parse })
}

/**
 * Merge the proposed expression into the base expression
 * @param {*} base
 * @param {*} proposed
 */
function merge(base, proposed) {
  // ensure that NOASSERTION is overwritten by anything other than null or undefined
  if (!base) return proposed
  if (!proposed) return base
  if (base === 'NOASSERTION' || base.hasOwnProperty('noassertion')) return proposed
  if (proposed === 'NOASSERTION' || proposed.hasOwnProperty('noassertion')) return base
  if (satisfies(proposed, base)) return base
  if (satisfies(base, proposed)) return proposed

  const baseExpanded = expandExpression(base)
  const proposedExpanded = expandExpression(proposed)
  const elements = []
  baseExpanded.forEach(b => {
    proposedExpanded.forEach(p => {
      elements.push(uniq(b.concat(p)))
    })
  })
  return _stringifyOrAnds(elements)
}

function _stringifyOrAnds(elements) {
  const result = elements.map(entry => entry.sort().join(' AND '))
  if (result.length === 1) return result[0]
  return `(${result.join(') OR (')})`
}

/**
 * Expands an expression into an array of AND statements that are OR'd together to be
 * equivalent to the original
 * @param {*} expression
 * @returns {[string]}
 */
function expandExpression(expression) {
  const result = Array.from(_expandExpressionInner(parse(expression)))
    .filter(e => Object.keys(e).length)
    .map(e => Object.keys(e))
    .sort()
  return uniqWith(result, isEqual)
}

// function _expandExpressionInner(expression, result = new Set(), current = {}) {
//   result.add(current)
//   if (expression.license) current[expression.license] = true
//   else {
//     if (expression.conjunction === 'or') {
//       const savedCurrent = { ...current }
//       _expandExpressionInner(expression.left, result, current)
//       _expandExpressionInner(expression.right, result, savedCurrent)
//     } else if (expression.conjunction === 'and') {
//       _expandExpressionInner(expression.left, result, current)
//       _expandExpressionInner(expression.right, result, current)
//     }
//   }
//   return result
// }

function _expandExpressionInner(expression) {
  // TODO add in modifiers
  if (expression.license) return [{ [expression.license]: true }]
  if (expression.hasOwnProperty('noassertion')) return [{ [NOASSERTION]: true }]
  if (expression.conjunction === 'or')
    return [..._expandExpressionInner(expression.left), ..._expandExpressionInner(expression.right)]
  if (expression.conjunction === 'and') {
    const left = _expandExpressionInner(expression.left)
    const right = _expandExpressionInner(expression.right)
    return left.reduce((result, l) => {
      right.forEach(r => result.push({ ...l, ...r }))
      return result
    }, [])
  }
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

module.exports = { parse, stringify, normalize, normalizeSingle, satisfies, lookupByName, expandExpression, merge }
