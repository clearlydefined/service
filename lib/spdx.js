// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const spdxExpressionParse = require('spdx-expression-parse')
const spdxSatisfies = require('spdx-satisfies')
const spdxLicenseList = require('spdx-license-list')
const spdxLicenseSet = require('spdx-license-list/simple')
const lowerSpdxLicenseMap = new Map(Array.from(spdxLicenseSet).map(x => [x.toLowerCase(), x]))
const lowerSpdxNameMap = new Map(Object.keys(spdxLicenseList).map(x => [spdxLicenseList[x].name.toLowerCase(), x]))
const { isEqual, sortBy, union, uniqWith } = require('lodash')

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
  if (obj.hasOwnProperty('noassertion') || obj.exception === NOASSERTION) return NOASSERTION
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
 * Expand the given expression into an equivalent array where each member is an array of licenses AND'd
 * together and the members are OR'd together. For example, `(MIT OR ISC) AND GPL-3.0` expands to
 * `[[GPL-3.0 AND MIT], [ISC AND MIT]]`. Note that within each array of licenses, the entries are
 * normalized (sorted) by license name.
 *
 * @param {*} expression - an SPDX license expression in string or object form
 * @returns {[[expression]]} - the normalized list of license expression leaves that are equivalent to the input
 */
function expand(expression) {
  return _sort(Array.from(_expandInner(parse(expression))))
}

/**
 * Flatten the given expression into an array of all licenses mentioned in the expression.
 *
 * @param {*} expression - an SPDX license expression in string or object form
 * @returns {[expression]} - an array of expression leaves
 */
function flatten(expression) {
  const expanded = Array.from(_expandInner(parse(expression)))
  const flattened = expanded.reduce((result, clause) => Object.assign(result, clause), {})
  return _sort([flattened])[0]
}

function _expandInner(expression) {
  if (!expression.conjunction) return [{ [stringify(expression)]: expression }]
  if (expression.conjunction === 'or') return _expandInner(expression.left).concat(_expandInner(expression.right))
  if (expression.conjunction === 'and') {
    const left = _expandInner(expression.left)
    const right = _expandInner(expression.right)
    return left.reduce((result, l) => {
      right.forEach(r => result.push(Object.assign({}, l, r)))
      return result
    }, [])
  }
}

function _sort(licenseList) {
  return uniqWith(licenseList, isEqual)
    .filter(e => Object.keys(e).length)
    .map(e => Object.keys(e).sort())
}

/**
 * Merge the proposed expression into the base expression
 * @param {*} proposed
 * @param {*} base
 */
function merge(proposed, base, mode = 'OR') {
  // ensure that missing values are ignored
  if (!base) return proposed
  if (!proposed) return base
  // ensure that NOASSERTION is overwritten
  if (base === 'NOASSERTION' || base.hasOwnProperty('noassertion')) return proposed
  if (proposed === 'NOASSERTION' || proposed.hasOwnProperty('noassertion')) return base

  // OK, need to merge. Expand both to their normalized form of ORs of ANDs and insert any
  // unique proposed clauses
  const baseExpanded = expand(base)
  const proposedExpanded = expand(proposed)
  // In OR mode, proposed is a new option so add it if it is not already covered
  if (mode === 'OR') {
    proposedExpanded.forEach(p => {
      if (!baseExpanded.some(b => isEqual(p, b))) baseExpanded.push(p)
    })
    return _stringifyOrAnds(baseExpanded)
  }
  // In AND mode, we have to cross all the proposed clauses with all the base clauses
  const merged = baseExpanded.reduce((result, b) => {
    proposedExpanded.forEach(p => result.push(union(b, p)))
    return result
  }, [])
  const sorted = merged.map(entry => entry.sort())
  return _stringifyOrAnds(sorted)
}

function _stringifyOrAnds(elements) {
  if (elements.length === 0) return ''
  elements = uniqWith(elements, isEqual)
  if (elements.length === 1) return elements[0].join(' AND ')
  const ands = elements.map(andArray => (andArray.length === 1 ? andArray[0] : '(' + andArray.join(' AND ') + ')'))
  // sort ANDs alphabetically and simple first. Note ( comes before alphas so trick by replacing with [ for sorting
  return sortBy(ands, entry => entry.replace('(', '[')).join(' OR ')
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

module.exports = { parse, stringify, normalize, normalizeSingle, satisfies, lookupByName, merge, expand, flatten }
