// (c) Copyright 2025, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const { expect } = chai
const validator = require('../../schemas/validator')

describe('Validator - Coordinates Schema Tests', () => {
  describe('Valid coordinates validation', () => {
    const validCoordinatesByType = [
      {
        type: 'npm',
        coordinates: [
          { type: 'npm', provider: 'npmjs', name: 'redis', revision: '0.1.0' },
          { type: 'npm', provider: 'npmjs', namespace: '@types', name: 'node', revision: '18.11.9' }
        ]
      },
      {
        type: 'conda',
        coordinates: [
          {
            type: 'conda',
            provider: 'conda-forge',
            namespace: 'linux-aarch64',
            name: 'numpy',
            revision: '1.16.6-py36hdc1b780_0'
          },
          {
            type: 'condasrc',
            provider: 'conda-forge',
            name: 'bzip2',
            revision: '1.0.8'
          }
        ]
      },
      {
        type: 'crate',
        coordinates: [{ type: 'crate', provider: 'cratesio', name: 'ratatui', revision: '0.26.0' }]
      },
      {
        type: 'deb',
        coordinates: [
          { type: 'deb', provider: 'debian', name: 'mini-httpd', revision: '1.30-0.2_arm64' },
          { type: 'debsrc', provider: 'debian', name: 'mini-httpd', revision: '1.30-0.2' }
        ]
      },
      {
        type: 'git',
        coordinates: [
          { type: 'git', provider: 'gitlab', namespace: 'gitlab-org', name: 'gitlab', revision: '15.6.0-ee' },
          {
            type: 'git',
            provider: 'github',
            namespace: 'ratatui-org',
            name: 'ratatui',
            revision: 'bcf43688ec4a13825307aef88f3cdcd007b32641'
          }
        ]
      },
      {
        type: 'go',
        coordinates: [{ type: 'go', provider: 'golang', namespace: 'rsc.io', name: 'quote', revision: 'v1.3.0' }]
      },
      {
        type: 'maven',
        coordinates: [
          {
            type: 'maven',
            provider: 'mavencentral',
            namespace: 'org.apache.httpcomponents',
            name: 'httpcore',
            revision: '4.4.16'
          },
          {
            type: 'maven',
            provider: 'mavengoogle',
            namespace: 'android.arch.lifecycle',
            name: 'common',
            revision: '1.0.1'
          },
          {
            type: 'maven',
            provider: 'gradleplugin',
            namespace: 'io.github.lognet',
            name: 'grpc-spring-boot-starter-gradle-plugin',
            revision: '4.6.0'
          },
          {
            type: 'sourcearchive',
            provider: 'mavencentral',
            namespace: 'org.apache.httpcomponents',
            name: 'httpcore',
            revision: '4.1'
          }
        ]
      },
      {
        type: 'composer',
        coordinates: [
          {
            type: 'composer',
            provider: 'packagist',
            namespace: 'symfony',
            name: 'polyfill-mbstring',
            revision: 'v1.28.0'
          }
        ]
      },
      {
        type: 'nuget',
        coordinates: [{ type: 'nuget', provider: 'nuget', name: 'NuGet.Protocol', revision: '6.7.1' }]
      },
      {
        type: 'pod',
        coordinates: [
          { type: 'pod', provider: 'cocoapods', name: 'SoftButton', revision: '0.1.0' },
          { type: 'pod', provider: 'cocoapods', name: 'xcbeautify', revision: '0.9.1' }
        ]
      },
      {
        type: 'pypi',
        coordinates: [
          { type: 'pypi', provider: 'pypi', name: 'platformdirs', revision: '4.2.0' },
          { type: 'pypi', provider: 'pypi', name: 'sdbus', revision: '0.12.0' }
        ]
      },
      {
        type: 'gem',
        coordinates: [{ type: 'gem', provider: 'rubygems', name: 'sorbet', revision: '0.5.11226' }]
      }
    ]

    // Test valid coordinate examples for each type
    validCoordinatesByType.forEach(({ type, coordinates }) => {
      it(`validates valid ${type} coordinates`, () => {
        coordinates.forEach((coord, index) => {
          const isValid = validator.validate('coordinates-1.0', coord)
          expect(isValid, `Failed for ${type} coordinate ${index}: ${JSON.stringify(coord)}`).to.be.true
          expect(validator.errors).to.be.null
        })
      })
    })
  })

  describe('Invalid coordinates validation', () => {
    // Invalid coordinate examples for each error type
    const invalidCoordinatesByType = [
      {
        type: 'missing-required-fields',
        coordinates: [
          { provider: 'npmjs', name: 'test', revision: '1.0.0' }, // missing type
          { type: 'npm', revision: '1.0.0' }, // missing name
          { type: 'npm', name: 'test' } // missing revision
        ]
      },
      {
        type: 'invalid-field-values',
        coordinates: [
          { type: 'invalid', name: 'test', revision: '1.0.0' }, // invalid type
          { type: 'npm', provider: 'invalid', name: 'test', revision: '1.0.0' } // invalid provider
        ]
      },
      {
        type: 'invalid-field-types',
        coordinates: [
          { type: { invalid: 'object' }, name: 'test', revision: '1.0.0' },
          { type: 'npm', provider: ['npmjs'], name: 'test', revision: '1.0.0' },
          { type: 'npm', name: { invalid: 'object' }, revision: '1.0.0' },
          { type: 'npm', name: 'test', revision: ['1.0.0'] }
        ]
      },
      {
        type: 'additional-properties',
        coordinates: [
          { type: 'npm', name: 'test', revision: '1.0.0', invalid: 'property' },
          { type: 'npm', name: 'test', revision: '1.0.0', extra: 'field', another: 'invalid' }
        ]
      },
      {
        type: 'invalid-input-types',
        coordinates: [null, undefined, 'string', 123, [], true, false]
      }
    ]

    // Test invalid coordinate examples for each error type
    invalidCoordinatesByType.forEach(({ type, coordinates }) => {
      it(`rejects coordinates with ${type}`, () => {
        coordinates.forEach((coord, index) => {
          const isValid = validator.validate('coordinates-1.0', coord)
          expect(isValid, `Expected coordinate to be invalid for ${type} case ${index}: ${JSON.stringify(coord)}`).to.be
            .false
          expect(validator.errors).to.not.be.null
          expect(validator.errors).to.be.an('array')
          expect(validator.errors.length).to.be.greaterThan(0)
        })
      })
    })
  })
})
