const { omit, isEqual } = require('lodash')
const expect = require('chai').expect
const { callFetch } = require('../tools/fetch')
const { devApiBaseUrl, prodApiBaseUrl, components, definition } = require('./testConfig')

describe('Validate Definition between dev and prod', function () {
  it('should get definition for a component and compare to production', async function () {
    this.timeout(definition.timeout)
    for (const coordinates of components) {
      console.log(coordinates)
      await fetchAndCompareDefinition(coordinates)
      //Rest a bit to avoid overloading the server
      await new Promise(resolve => setTimeout(resolve, definition.timeout / components.length / 2))
    }
  })
})

async function fetchAndCompareDefinition(coordinates) {
  const [recomputedDef, expectedDef] = await Promise.all(
    [
      callFetch(`${devApiBaseUrl}/definitions/${coordinates}?force=true`),
      callFetch(`${prodApiBaseUrl}/definitions/${coordinates}`)
    ].map(p => p.then(r => r.json()))
  )
  compareDefinition(recomputedDef, expectedDef)
}

function compareDefinition(recomputedDef, expectedDef) {
  expect(recomputedDef.coordinates).to.be.deep.equals(expectedDef.coordinates)
  compareLicensed(recomputedDef, expectedDef)
  compareDescribed(recomputedDef, expectedDef)
  compareFiles(recomputedDef, expectedDef)
  expect(recomputedDef.score).to.be.deep.equal(expectedDef.score)
}

function compareLicensed(result, expectation) {
  const actual = omit(result.licensed, ['facets'])
  const expected = omit(expectation.licensed, ['facets'])
  expect(actual).to.be.deep.equals(expected)
}

function compareDescribed(result, expectation) {
  const actual = omit(result.described, ['tools'])
  const expected = omit(expectation.described, ['tools'])
  expect(actual).to.be.deep.equals(expected)
}

function compareFiles(result, expectation) {
  const resultFiles = filesToMap(result)
  const expectedFiles = filesToMap(expectation)
  const extraInResult = result.files.filter(f => !expectedFiles.has(f.path))
  const missingInResult = expectation.files.filter(f => !resultFiles.has(f.path))
  const differentEntries = result.files.filter(f => expectedFiles.has(f.path) && !isEqual(expectedFiles.get(f.path), f))

  const differences = [...extraInResult, ...missingInResult, ...differentEntries]
  differences.forEach(f => logDifferences(expectedFiles.get(f.path), resultFiles.get(f.path)))

  expect(missingInResult.length).to.be.equal(0, 'Some files are missing in the result')
  expect(extraInResult.length).to.be.equal(0, 'There are extra files in the result')
  expect(differentEntries.length).to.be.equal(0, 'Some files are different between the result and the expectation')
}

function logDifferences(expected, actual) {
  console.log('-------------------')
  console.log(`expected: ${JSON.stringify(expected || {})}`)
  console.log(`actual:   ${JSON.stringify(actual || {})}`)
}

function filesToMap(result) {
  return new Map(result.files.map(f => [f.path, f]))
}
