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
    sinon.stub(coordinatesMapper, '_query').rejects('should not be called')
    const specWithNameSpace = 'maven/gradleplugin/namespace/org.springframework.boot/1.4.2.RELEASE'
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString(specWithNameSpace))
    expect(mapped).to.be.null
  })

  it('spec without namespace', async () => {
    const stub = sinon.stub(coordinatesMapper, '_query').resolves(fs.readFileSync('test/fixtures/maven/pom.xml'))
    const specWithoutNameSpace = 'maven/gradleplugin/-/org.springframework.boot/1.4.2.RELEASE'
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString(specWithoutNameSpace))

    stub.calledOn('https://plugins.gradle.org/m2/org/springframework/boot/org.springframework.boot.gradle.plugin/1.4.2.RELEASE/org.springframework.boot.gradle.plugin-1.4.2.RELEASE.pom')
    expect(mapped.namespace).to.be.eq('org.springframework.boot')
    expect(mapped.name).to.be.eq('spring-boot-gradle-plugin')
    expect(mapped.revision).to.be.eq('1.4.2.RELEASE')
  })

  it('invalid spec handle 404', async () => {
    sinon.stub(coordinatesMapper, '_query').rejects({ statusCode: 404 })
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString('maven/gradleplugin/-/name/invalid'))
    expect(mapped).not.to.be.ok
  })
})