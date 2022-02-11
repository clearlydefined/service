// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT


const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('fs')
const EntityCoordinates = require('../../lib/entityCoordinates')
const GradleCoordinatesMapper = require('../../lib/gradleCoordinatesMapper')

describe('GradleCoordinatesMapper', () => {

  let coordinatesMapper
  beforeEach(() => {
    coordinatesMapper = new GradleCoordinatesMapper()
  })

  it('spec with namespace', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest').rejects('should not be called')
    const specWithNameSpace = 'maven/gradleplugin/namespace/org.springframework.boot/1.4.2.RELEASE'
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString(specWithNameSpace))
    expect(mapped).to.be.null
  })

  it('spec without namespace', async () => {
    const stub = sinon.stub(coordinatesMapper, '_handleRequest').resolves(fs.readFileSync('test/fixtures/maven/pom.xml'))
    const specWithoutNameSpace = 'maven/gradleplugin/-/org.springframework.boot/1.4.2.RELEASE'
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString(specWithoutNameSpace))

    stub.calledOn('https://plugins.gradle.org/m2/org/springframework/boot/org.springframework.boot.gradle.plugin/1.4.2.RELEASE/org.springframework.boot.gradle.plugin-1.4.2.RELEASE.pom')
    expect(mapped.namespace).to.be.eq('org.springframework.boot')
    expect(mapped.name).to.be.eq('spring-boot-gradle-plugin')
    expect(mapped.revision).to.be.eq('1.4.2.RELEASE')
  })

  it('invalid spec handle 404', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest').rejects({ statusCode: 404 })
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString('maven/gradleplugin/-/name/invalid'))
    expect(mapped).not.to.be.ok
  })

  it('spec without revision', async () => {
    sinon.stub(coordinatesMapper, '_handleRequest')
      .withArgs('https://plugins.gradle.org/m2/pluginId/pluginId.gradle.plugin/maven-metadata.xml')
      .resolves(fs.readFileSync('test/fixtures/maven/maven-metadata.xml'))
      .withArgs('https://plugins.gradle.org/m2/pluginId/pluginId.gradle.plugin/4.5.10/pluginId.gradle.plugin-4.5.10.pom')
      .resolves(fs.readFileSync('test/fixtures/maven/pom.xml'))
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString('maven/gradleplugin/-/pluginId'))
    expect(mapped.revision).not.to.be.ok
    expect(mapped.namespace).to.be.equal('org.springframework.boot')
    expect(mapped.name).to.be.equal('spring-boot-gradle-plugin')
  })

  it('_getLatestVersion', async () => {
    const stub = sinon.stub(coordinatesMapper, '_handleRequest').resolves(fs.readFileSync('test/fixtures/maven/maven-metadata.xml'))
    const latest = await coordinatesMapper._getLatestVersion({ name: 'pluginId' })
    stub.calledOn('https://plugins.gradle.org/m2/pluginId/pluginId.gradle.plugin/maven-metadata.xml')
    expect(latest).to.be.equal('4.5.10')
  })

  it('getMavenMetadata', async () => {
    const metadata = fs.readFileSync('test/fixtures/maven/maven-metadata.xml')
    const stub = sinon.stub(coordinatesMapper, '_handleRequest').resolves(metadata)
    const retrieved = await coordinatesMapper.getMavenMetadata('name')
    stub.calledOn('https://plugins.gradle.org/m2/pluginId/pluginId.gradle.plugin/maven-metadata.xml')
    expect(retrieved).to.be.equal(metadata)
  })
})