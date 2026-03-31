import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import yaml from 'js-yaml'
import Curation from '../../lib/curation.js'

function errorMessage(curation: InstanceType<typeof Curation>, index = 0): string {
  return (curation.errors[index].error as { message: string }).message
}

function getFixture(file: string) {
  return fs.readFileSync(path.join('test/fixtures', file), { encoding: 'utf8' })
}

describe('Curations', () => {
  it('should identify invalid yaml files', () => {
    const content = '@#$%%'
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(curation.errors[0].message, 'Invalid yaml')
  })

  it('should identify invalid date', () => {
    const content = getFixture('curation-invalid.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Release date must be formatted as a YYYY-MM-DD')
  })

  it('should identify invalid facet array', () => {
    const content = getFixture('curation-invalid.1.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Coordinates object require type, provider, namespace, and name')
    assert.strictEqual(errorMessage(curation, 1), 'Glob list must be an array')
  })

  it('should identify invalid facet field: unknown', () => {
    const content = getFixture('curation-invalid.2.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Facets object can only contain data, dev, doc, examples, and tests')
  })

  it('should identify invalid field: facets not in licensed', () => {
    const content = getFixture('curation-invalid.3.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Licensed object can only contain declared')
  })

  it('should identify invalid coordinate provider (test enum)', () => {
    const content = getFixture('curation-invalid.4.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Provider type must be supported by ClearlyDefined')
  })

  it('should identify invalid revision (no revision)', () => {
    const content = getFixture('curation-invalid.5.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Revisions must be an object')
  })

  it('should identify invalid source location (no revision)', () => {
    const content = getFixture('curation-invalid.6.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Revision must be a string')
  })

  it('should identify invalid source location (url not URI format)', () => {
    const content = getFixture('curation-invalid.7.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'URL must be formatted as a URI')
  })

  it('should identify invalid file (missing required path)', () => {
    const content = getFixture('curation-invalid.8.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Files elements object requires path')
  })

  it('should identify invalid declared license (incorrect key)', () => {
    const content = getFixture('curation-invalid.9.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(errorMessage(curation), 'Licensed object can only contain declared')
  })

  describe('declared licenses', () => {
    let content: string
    beforeEach(() => {
      content = getFixture('curation-invalid.10.yaml')
    })

    it('should identify invalid declared licenses (not SPDX license)', () => {
      const curation = new Curation(content)
      assert.strictEqual(curation.isValid, false)
      assert.strictEqual(curation.errors[0].error, '4.17.4 licensed.declared with value "asdf" is not SPDX compliant')
    })

    it('should identify non-normalized declared licenses (SPDX license)', () => {
      const realContent = content.replace('asdf', 'mit AND apache-2.0')
      const curation = new Curation(realContent)
      assert.strictEqual(curation.isValid, false)
      assert.strictEqual(curation.errors[0].error, 
        '4.17.4 licensed.declared with value "mit AND apache-2.0" is not normalized. Suggest using "MIT AND Apache-2.0"'
      )
    })
  })

  describe('file licenses', () => {
    let content: string
    let licenseToReplace: string
    beforeEach(() => {
      content = getFixture('curation-invalid.11.yaml')
      licenseToReplace = 'mit and apache-2.0'
    })

    it('should identify invalid file licenses (not SPDX valid)', () => {
      const curation = new Curation(content)
      assert.strictEqual(curation.isValid, false)
      assert.strictEqual(curation.errors[0].error, 
        '/foo in 4.17.4 files with value "mit and apache-2.0" is not SPDX compliant'
      )
    })

    it('should identify invalid file licenses(not SPDX compliant)', () => {
      const realContent = content.replace(licenseToReplace, 'mit AND JUNK')
      const curation = new Curation(realContent)
      assert.strictEqual(curation.isValid, false)
      assert.strictEqual(curation.errors[0].error, '/foo in 4.17.4 files with value "mit AND JUNK" is not SPDX compliant')
    })

    it('should identify NOASSERTION file licenses', () => {
      const realContent = content.replace(licenseToReplace, 'NOASSERTION')
      const curation = new Curation(realContent)
      assert.strictEqual(curation.isValid, false)
      assert.strictEqual(curation.errors[0].error, '/foo in 4.17.4 files with value "NOASSERTION" is not SPDX compliant')
    })

    it('should identify file licenses including NOASSERTION', () => {
      const realContent = content.replace(licenseToReplace, 'MIT AND NOASSERTION')
      const curation = new Curation(realContent)
      assert.strictEqual(curation.isValid, false)
      assert.strictEqual(curation.errors[0].error, 
        '/foo in 4.17.4 files with value "MIT AND NOASSERTION" is not SPDX compliant'
      )
    })

    it('should identify non normalized file license expression', () => {
      const realContent = content.replace(licenseToReplace, '(mit) AND apache-2.0')
      const curation = new Curation(realContent)
      assert.strictEqual(curation.isValid, false)
      assert.strictEqual(curation.errors[0].error, 
        '/foo in 4.17.4 files with value "(mit) AND apache-2.0" is not normalized. Suggest using "MIT AND Apache-2.0"'
      )
    })

    it('should identify non normalized file licenses', () => {
      const realContent = content.replace(licenseToReplace, 'mit AND apache-2.0')
      const curation = new Curation(realContent)
      assert.strictEqual(curation.isValid, false)
      assert.strictEqual(curation.errors[0].error, 
        '/foo in 4.17.4 files with value "mit AND apache-2.0" is not normalized. Suggest using "MIT AND Apache-2.0"'
      )
    })
  })

  it('should identify valid curations', () => {
    const content = getFixture('curation-valid.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, true)
    assert.ok(!curation.errors.length)
  })

  it('should identify valid curations (all fields)', () => {
    const content = getFixture('curation-valid.1.yaml')
    const curation = new Curation(content)
    assert.strictEqual(curation.isValid, true)
    assert.ok(!curation.errors.length)
  })

  it('should also accept yaml data objects', () => {
    const data = yaml.load('foo: bar')
    const curation = new Curation(data)
    assert.strictEqual(curation.isValid, false)
    assert.strictEqual(curation.errors[0].message, 'Invalid curation')
  })
})
