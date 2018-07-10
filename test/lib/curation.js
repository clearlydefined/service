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
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid facet array', () => {
    const content = getFixture('curation-invalid.1.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid props: unknown', () => {
    const content = getFixture('curation-invalid.2.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid props: facets not in licensed', () => {
    const content = getFixture('curation-invalid.3.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid coordinate provider (test enum)', () => {
    const content = getFixture('curation-invalid.4.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid revision (no revision)', () => {
    const content = getFixture('curation-invalid.5.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid source location (no revision)', () => {
    const content = getFixture('curation-invalid.6.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid source location (url not URI format)', () => {
    const content = getFixture('curation-invalid.7.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid file (missing required path)', () => {
    const content = getFixture('curation-invalid.8.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })

  it('should identify invalid declared license (incorrect key)', () => {
    const content = getFixture('curation-invalid.9.yaml')
    const curation = new Curation(content)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
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
    const data = yaml.safeLoad('foo: bar')
    const curation = new Curation(data)
    expect(curation.isValid).to.be.false
    expect(curation.errors[0].message).to.equal('Invalid curation')
  })
})
