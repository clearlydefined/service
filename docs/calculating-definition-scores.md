# How ClearlyDefined Scores are calculated

If you look at a component on ClearlyDefined such as [this one](https://clearlydefined.io/definitions/maven/mavencentral/org.opendaylight.controller/sal-common-util/4.0.6), you will see two types of scores:

- Described
- Licensed

## Described

The Described Score is based on two factors:

- Whether the definition has a release date
- Whether the definition has a source location URL

See below for more details

## Licensed

The license score is based on several factors:

- whether the definition has a declared license
- whether the definition has discovered licenses
- whether the declared and discovered licenses are consistent
- whether the declared license can be parsed as an SPDX expression
- whether all there is text available for all referenced licenses

This document explores how these scores are calculated.

## Where it starts

Computing ClearlyDefined scores starts in

**service/business/definitionService.js**

```javascript
  _computeScores(definition) {
    return {
      licensedScore: this._computeLicensedScore(definition),
      describedScore: this._computeDescribedScore(definition)
    }
  }
```

- this function returns a "Licensed Score" and "Declared Score"

## Calculating the Licensed Score

There are several parts that go into computing the Licensed Score

- declared score
- discovered score
- consistency score
- spdx score
- texts score

```javascript
  _computeLicensedScore(definition) {
    const declared = this._computeDeclaredScore(definition)
    const discovered = this._computeDiscoveredScore(definition)
    const consistency = this._computeConsistencyScore(definition)
    const spdx = this._computeSPDXScore(definition)
    const texts = this._computeTextsScore(definition)
    const total = declared + discovered + consistency + spdx + texts
    return { total, declared, discovered, consistency, spdx, texts }
  }
```

- it then adds the scores together and returns the total along with the various scores

### Declared Score

```javascript
  _computeDeclaredScore(definition) {
    const declared = get(definition, 'licensed.declared')
    return isDeclaredLicense(declared) ? weights.declared : 0
  }
```

The `isDeclaredLicense` function lives in `lib/utils`

**lib/utils.js**

```javascript
/**
 * Determine if a given string is a declared license
 * To be a declared license it must be set and not be NOASSERTION nor NONE
 *
 * @param {string} identifier
 * @returns {boolean}
 */
function isDeclaredLicense(identifier) {
  return identifier && identifier !== 'NOASSERTION' && identifier !== 'NONE'
}
```

If `isDeclaredLicense` returns true, then `_computeDeclaredScore(definition)` returns the appropriate weight for the declared score.

```javascript
const weights = { declared: 30, discovered: 25, consistency: 15, spdx: 15, texts: 15, date: 30, source: 70 }
```

### Discovered Score

```javascript
  _computeDiscoveredScore(definition) {
    if (!definition.files) return 0
    const coreFiles = definition.files.filter(DefinitionService._isInCoreFacet)
    if (!coreFiles.length) return 0
    const completeFiles = coreFiles.filter(file => file.license && (file.attributions && file.attributions.length))
    return Math.round((completeFiles.length / coreFiles.length) * weights.discovered)
  }
```

- checks for files in the definition
- if there are no files, returns 0
- filters out files in the core facet
- if there are no files in the core facet, returns 0
- filters out files that have a licenses and attributions
- divides files in the core facet / files that have licenses and attributions, then multiplies that number by the weight for the discovered score

```javascript
const weights = { declared: 30, discovered: 25, consistency: 15, spdx: 15, texts: 15, date: 30, source: 70 }
```

### Consistency Score

```javascript
  _computeConsistencyScore(definition) {
    const declared = get(definition, 'licensed.declared')
    // Note here that we are saying that every discovered license is satisfied by the declared
    // license. If there are no discovered licenses then all is good.
    const discovered = get(definition, 'licensed.facets.core.discovered.expressions') || []
    if (!declared || !discovered) return 0
    return discovered.every(expression => SPDX.satisfies(expression, declared)) ? weights.consistency : 0
  }
```

- searches for declared and discovered licenses
- if there are no declared or discovered licenses, return 0
- otherwise, it checks whether every discovered license is compatible with the declared license(s)
- if so, it returns the weight for consistency

```javascript
const weights = { declared: 30, discovered: 25, consistency: 15, spdx: 15, texts: 15, date: 30, source: 70 }
```

### SPDX Score

```javascript
  _computeSPDXScore(definition) {
    try {
      parse(get(definition, 'licensed.declared')) // use strict spdx-expression-parse
      return weights.spdx
    } catch (e) {
      return 0
    }
  }
```

- checks whether the declared license can be parsed
- if so, returns weight for spdx

```javascript
const weights = { declared: 30, discovered: 25, consistency: 15, spdx: 15, texts: 15, date: 30, source: 70 }
```

### Texts Score

```javascript
  _computeTextsScore(definition) {
    if (!definition.files || !definition.files.length) return 0
    const includedTexts = this._collectLicenseTexts(definition)
    if (!includedTexts.length) return 0
    const referencedLicenses = this._collectReferencedLicenses(definition)
    if (!referencedLicenses.length) return 0

    // check that all the referenced licenses have texts
    const found = intersection(referencedLicenses, includedTexts)
    return found.length === referencedLicenses.length ? weights.texts : 0
  }
```

- checks for definition files
- collects license texts

```javascript
  // Get the full set of license texts captured in the definition
  _collectLicenseTexts(definition) {
    const result = new Set()
    definition.files
      .filter(DefinitionService._isLicenseFile)
      .forEach(file => this._extractLicensesFromExpression(file.license, result))
    return Array.from(result)
  }
```

- collects referenced licenses

```javascript
  // get all the licenses that have been referenced anywhere in the definition (declared and core)
  _collectReferencedLicenses(definition) {
    const referencedExpressions = new Set(get(definition, 'licensed.facets.core.discovered.expressions') || [])
    const declared = get(definition, 'licensed.declared')
    if (declared) referencedExpressions.add(declared)
    const result = new Set()
    referencedExpressions.forEach(expression => this._extractLicensesFromExpression(expression, result))
    return Array.from(result)
  }
```

- checks that all referenced licenses have texts
- if they do, returns texts weight

```javascript
const weights = { declared: 30, discovered: 25, consistency: 15, spdx: 15, texts: 15, date: 30, source: 70 }
```

## Calculating the Described Score

```javascript
  // Given a definition, calculate and return the score for the described dimension
  _computeDescribedScore(definition) {
    const date = get(definition, 'described.releaseDate') ? weights.date : 0
    const source = get(definition, 'described.sourceLocation.url') ? weights.source : 0
    const total = date + source
    return { total, date, source }
  }
```

- checks whether the definition has a release date. If so, applies the date weight.
- Also checks whether the definition has a source location url. If so, applies the source weight:

```javascript
const weights = { declared: 30, discovered: 25, consistency: 15, spdx: 15, texts: 15, date: 30, source: 70 }
```
