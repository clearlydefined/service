// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import fs from 'node:fs'
import assert from 'node:assert/strict'
import { describe, it, beforeEach, mock } from 'node:test'
import EntityCoordinates from '../../lib/entityCoordinates.js'
import GradleCoordinatesMapper from '../../lib/gradleCoordinatesMapper.js'

describe('GradleCoordinatesMapper', () => {
  let coordinatesMapper: any
  beforeEach(() => {
    coordinatesMapper = new GradleCoordinatesMapper()
  })

  it('spec with namespace', async (t) => {
    t.mock.method(coordinatesMapper, '_handleRequest', async () => { throw new Error('should not be called') })
    const specWithNameSpace = 'maven/gradleplugin/namespace/org.springframework.boot/1.4.2.RELEASE'
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString(specWithNameSpace))
    assert.strictEqual(mapped, null)
  })

  it('spec without namespace', async (t) => {
    t.mock.method(coordinatesMapper, '_handleRequest', async () => fs.readFileSync('test/fixtures/maven/pom.xml'))
    const specWithoutNameSpace = 'maven/gradleplugin/-/org.springframework.boot/1.4.2.RELEASE'
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString(specWithoutNameSpace))

    assert.strictEqual(mapped.namespace, 'org.springframework.boot')
    assert.strictEqual(mapped.name, 'spring-boot-gradle-plugin')
    assert.strictEqual(mapped.revision, '1.4.2.RELEASE')
  })

  it('invalid spec handle 404', async (t) => {
    t.mock.method(coordinatesMapper, '_handleRequest', async () => { throw { statusCode: 404 } })
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString('maven/gradleplugin/-/name/invalid'))
    assert.ok(!mapped)
  })

  it('spec without revision', async (t) => {
    const pomContent = fs.readFileSync('test/fixtures/maven/pom.xml')
    const metadataContent = fs.readFileSync('test/fixtures/maven/maven-metadata.xml')
    t.mock.method(coordinatesMapper, '_handleRequest', async (url: string) => {
      if (url.includes('maven-metadata.xml')) return metadataContent
      if (url.includes('.pom')) return pomContent
      throw new Error('unexpected url: ' + url)
    })
    const mapped = await coordinatesMapper.map(EntityCoordinates.fromString('maven/gradleplugin/-/pluginId'))
    assert.ok(!mapped.revision)
    assert.strictEqual(mapped.namespace, 'org.springframework.boot')
    assert.strictEqual(mapped.name, 'spring-boot-gradle-plugin')
  })

  it('_getLatestVersion', async (t) => {
    t.mock.method(coordinatesMapper, '_handleRequest', async () => fs.readFileSync('test/fixtures/maven/maven-metadata.xml'))
    const latest = await coordinatesMapper._getLatestVersion({ name: 'pluginId' })
    assert.strictEqual(latest, '4.5.10')
  })

  it('getMavenMetadata', async (t) => {
    const metadata = fs.readFileSync('test/fixtures/maven/maven-metadata.xml')
    t.mock.method(coordinatesMapper, '_handleRequest', async () => metadata)
    const retrieved = await coordinatesMapper.getMavenMetadata('name')
    assert.strictEqual(retrieved, metadata)
  })
})
