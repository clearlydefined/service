const { expect } = require('chai')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const Curation = require('../../lib/curation')

function getFixture(file) {
  return fs.readFileSync(path.join(__dirname, '../fixtures', file), { encoding: 'utf8' })
}

describe('Curations', () => {
  it('should identify invalid yaml files', () => {
    const content = '@#$%%'
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid yaml')
  })

  it('should identify invalid date', () => {
    const content = getFixture('curation-invalid.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('Release date must be formatted as a YYYY-MM-DD')
  })

  it('should identify invalid facet array', () => {
    const content = getFixture('curation-invalid.1.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('Coordinates object require type, provider, namespace, and name')
    expect(curation.errors[1].error.message).to.equal('Glob list must be an array')
  })

  it('should identify invalid facet field: unknown', () => {
    const content = getFixture('curation-invalid.2.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal(
      'Facets object can only contain data, dev, doc, examples, and tests'
    )
  })

  it('should identify invalid field: facets not in licensed', () => {
    const content = getFixture('curation-invalid.3.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('Licensed object can only contain declared')
  })

  it('should identify invalid coordinate provider (test enum)', () => {
    const content = getFixture('curation-invalid.4.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('Provider type must be supported by ClearlyDefined')
  })

  it('should identify invalid revision (no revision)', () => {
    const content = getFixture('curation-invalid.5.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('Revisions must be an object')
  })

  it('should identify invalid source location (no revision)', () => {
    const content = getFixture('curation-invalid.6.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('Revision must be a string')
  })

  it('should identify invalid source location (url not URI format)', () => {
    const content = getFixture('curation-invalid.7.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('URL must be formatted as a URI')
  })

  it('should identify invalid file (missing required path)', () => {
    const content = getFixture('curation-invalid.8.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('Files elements object requires path')
  })

  it('should identify invalid declared license (incorrect key)', () => {
    const content = getFixture('curation-invalid.9.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].error.message).to.equal('Licensed object can only contain declared')
  })

  describe('declared licenses', () => {
    let content
    beforeEach(() => {
      content = getFixture('curation-invalid.10.yaml')
    })

    it('should identify invalid declared licenses (not SPDX license)', () => {
      const curation = new Curation(content)
      expect(curation.isValid).to.be.false
      expect(curation.errors[0].error).to.equal('4.17.4 licensed.declared with value "asdf" is not SPDX compliant')
    })

    it('should identify non-normalized declared licenses (SPDX license)', () => {
      const realContent = content.replace('asdf', 'mit AND apache-2.0')
      const curation = new Curation(realContent)
      expect(curation.isValid).to.be.false
      expect(curation.errors[0].error).to.equal(
        '4.17.4 licensed.declared with value "mit AND apache-2.0" is not normalized. Suggest using "MIT AND Apache-2.0"'
      )
    })
  })

  describe('file licenses', () => {
    let content, licenseToReplace
    beforeEach(() => {
      content = getFixture('curation-invalid.11.yaml')
      licenseToReplace = 'mit and apache-2.0'
    })

    it('should identify invalid file licenses (not SPDX valid)', () => {
      const curation = new Curation(content)
      expect(curation.isValid).to.be.false
      expect(curation.errors[0].error).to.equal(
        '/foo in 4.17.4 files with value "mit and apache-2.0" is not SPDX compliant'
      )
    })

    it('should identify invalid file licenses(not SPDX compliant)', () => {
      const realContent = content.replace(licenseToReplace, 'mit AND JUNK')
      const curation = new Curation(realContent)
      expect(curation.isValid).to.be.false
      expect(curation.errors[0].error).to.equal('/foo in 4.17.4 files with value "mit AND JUNK" is not SPDX compliant')
    })

    it('should identify NOASSERTION file licenses', () => {
      const realContent = content.replace(licenseToReplace, 'NOASSERTION')
      const curation = new Curation(realContent)
      expect(curation.isValid).to.be.false
      expect(curation.errors[0].error).to.equal('/foo in 4.17.4 files with value "NOASSERTION" is not SPDX compliant')
    })

    it('should identify file licenses including NOASSERTION', () => {
      const realContent = content.replace(licenseToReplace, 'MIT AND NOASSERTION')
      const curation = new Curation(realContent)
      expect(curation.isValid).to.be.false
      expect(curation.errors[0].error).to.equal(
        '/foo in 4.17.4 files with value "MIT AND NOASSERTION" is not SPDX compliant'
      )
    })

    it('should identify non normalized file license expression', () => {
      const realContent = content.replace(licenseToReplace, '(mit) AND apache-2.0')
      const curation = new Curation(realContent)
      expect(curation.isValid).to.be.false
      expect(curation.errors[0].error).to.equal(
        '/foo in 4.17.4 files with value "(mit) AND apache-2.0" is not normalized. Suggest using "MIT AND Apache-2.0"'
      )
    })

    it('should identify non normalized file licenses', () => {
      const realContent = content.replace(licenseToReplace, 'mit AND apache-2.0')
      const curation = new Curation(realContent)
      expect(curation.isValid).to.be.false
      expect(curation.errors[0].error).to.equal(
        '/foo in 4.17.4 files with value "mit AND apache-2.0" is not normalized. Suggest using "MIT AND Apache-2.0"'
      )
    })
  })

  it('should identify valid curations', () => {
    const content = getFixture('curation-valid.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.true
    expect(curation.errors.length).to.not.be.ok
  })

  it('should identify valid curations (all fields)', () => {
    const content = getFixture('curation-valid.1.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.true
    expect(curation.errors.length).to.not.be.ok
  })

  it('should also accept yaml data objects', () => {
    const data = yaml.load('foo: bar')
    const curation = new Curation(data)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })
})
