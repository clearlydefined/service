const {
  LicenseMatcher, DefinitionLicenseMatchPolicy, HarvestLicenseMatchPolicy
} = require('../../lib/licenseMatcher')
const EntityCoordinates = require('../../lib/entityCoordinates')
const { expect } = require('chai')

describe('licenseMatcher.js', () => {
  describe('LicenseMatcher process()', () => {
    it('Should return NOT match if any policy returns mismatch', () => {
      const mismatch = { propPath: 'path.to.license.prop', source: 'license1', target: 'license2' }
      const matcher = new LicenseMatcher([
        {
          compare: () => ({ match: [{}], mismatch: [mismatch] }),
        },
        {
          compare: () => ({ match: [{}], mismatch: [] }),
        }
      ])
      const result = matcher.process({}, {})
      expect(result).to.have.property('isMatching', false)
      expect(result.mismatch).to.deep.include(mismatch)
    })

    it('Should return NOT match if all policy returns empty mismatch and empty match', () => {
      const matcher = new LicenseMatcher([
        {
          compare: () => ({ match: [], mismatch: [] }),
        },
        {
          compare: () => ({ match: [], mismatch: [] }),
        }
      ])
      const result = matcher.process({}, {})
      expect(result.mismatch).to.have.lengthOf(0)
      expect(result).to.have.property('isMatching', false)
    })

    it('Should return match when the every policy match', () => {
      const firstMatch = { policy: '1', propPath: 'path.to.license.prop1', value: 'license1' }
      const secondMatch = { policy: '2', propPath: 'path.to.license.prop2', value: 'license2' }
      const matcher = new LicenseMatcher([
        {
          compare: () => ({ match: [firstMatch], mismatch: [] }),
        },
        {
          compare: () => ({ match: [secondMatch], mismatch: [] }),
        }
      ])
      const result = matcher.process({}, {})
      expect(result).to.have.property('isMatching', true)
      expect(result.match).to.have.lengthOf(2).and.to.have.deep.members([firstMatch, secondMatch])
    })
  })

  describe('DefinitionLicenseMatchPolicy compare()', () => {
    const definitionLicenseMatchPolicy = new DefinitionLicenseMatchPolicy()
    it('Should return match array includes the same hashes.sha1', () => {
      const coordinates = { type: 'npm' }
      const sourceDefinition = {
        "files": [{
          "path": "package/LICENSE",
          "hashes": {
            "sha1": "dbf8c7e394791d3de9a9fff305d8ee7b59196f26",
          }
        }]
      }

      const targetDefinition = {
        "files": [{
          "path": "package/LICENSE",
          "hashes": {
            "sha1": "dbf8c7e394791d3de9a9fff305d8ee7b59196f26",
          }
        }]
      }

      const result = definitionLicenseMatchPolicy.compare(
        { definition: { ...sourceDefinition, coordinates } },
        { definition: { ...targetDefinition, coordinates } }
      )
      expect(result.match).to.have.lengthOf(1).and.deep.include({
        policy: definitionLicenseMatchPolicy.name,
        file: 'package/LICENSE',
        propPath: 'hashes.sha1',
        value: 'dbf8c7e394791d3de9a9fff305d8ee7b59196f26'
      })
      expect(result.mismatch).to.have.lengthOf(0)
    })

    it('Should return match array includes the same hashes.sha256', () => {
      const coordinates = { type: 'pypi', name: 'foo', revision: '1.0.0' }
      const sourceDefinition = {
        "files": [{
          "path": "foo-1.0.0/LICENSE",
          "hashes": {
            "sha256": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d",
          }
        }]
      }

      const targetDefinition = {
        "files": [{
          "path": "foo-1.0.0/LICENSE",
          "hashes": {
            "sha256": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d",
          }
        }]
      }

      const result = definitionLicenseMatchPolicy.compare(
        { definition: { ...sourceDefinition, coordinates } },
        { definition: { ...targetDefinition, coordinates } }
      )
      expect(result.match).to.have.lengthOf(1).and.deep.include({
        policy: definitionLicenseMatchPolicy.name,
        file: 'foo-1.0.0/LICENSE',
        propPath: 'hashes.sha256',
        value: 'd9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d'
      })
      expect(result.mismatch).to.have.lengthOf(0)
    })

    it('Should return match array includes the same token', () => {
      const coordinates = { type: 'maven' }
      const sourceDefinition = {
        "files": [{
          "path": "meta-inf/LICENSE",
          "token": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d"
        }]
      }

      const targetDefinition = {
        "files": [{
          "path": "meta-inf/LICENSE",
          "token": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d"
        }]
      }

      const result = definitionLicenseMatchPolicy.compare(
        { definition: { ...sourceDefinition, coordinates } },
        { definition: { ...targetDefinition, coordinates } }
      )
      expect(result.match).to.have.lengthOf(1).and.deep.include({
        policy: definitionLicenseMatchPolicy.name,
        file: 'meta-inf/LICENSE',
        propPath: 'token',
        value: 'd9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d'
      })
      expect(result.mismatch).to.have.lengthOf(0)
    })

    it('Should return empty match and mismatch array when no license files found', () => {
      const sourceDefinition = {
        "path": "NOT-A-License-File",
        "files": [{
          "token": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d"
        }]
      }

      const targetDefinition = {
        "path": "NOT-A-License-File",
        "files": [{
          "token": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d"
        }]
      }

      const result = definitionLicenseMatchPolicy.compare(
        { definition: sourceDefinition },
        { definition: targetDefinition }
      )
      expect(result.match).to.have.lengthOf(0)
      expect(result.mismatch).to.have.lengthOf(0)
    })

    it(`Should return mismatch array when file license hashes.sha1 are different`, () => {
      const sourceDefinition = {
        "files": [{
          "path": "license.md",
          "hashes": {
            "sha1": "dbf8c7e394791d3de9a9fff305d8ee7b59196f26",
          }
        }]
      }

      const targetDefinition = {
        "files": [{
          "path": "license.md",
          "hashes": {
            "sha1": "dbf8c7e394791d3de9a9fff305d8ee7b59196f26-Diff",
          }
        }]
      }

      const result = definitionLicenseMatchPolicy.compare(
        { definition: sourceDefinition },
        { definition: targetDefinition }
      )
      expect(result.match).to.have.lengthOf(0)
      expect(result.mismatch).to.have.lengthOf(1).and.deep.include({
        policy: definitionLicenseMatchPolicy.name,
        file: 'license.md',
        propPath: 'hashes.sha1',
        source: 'dbf8c7e394791d3de9a9fff305d8ee7b59196f26',
        target: 'dbf8c7e394791d3de9a9fff305d8ee7b59196f26-Diff'
      })
    })

    it(`Should return match array when all license file matched`, () => {
      const coordinates = { type: 'maven' }
      const sourceDefinition = {
        "files": [{
          "path": "meta-inf/LICENSE",
          "token": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d"
        },
        {
          "path": "LICENSE",
          "token": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d"
        }]
      }

      const targetDefinition = {
        "files": [{
          "path": "LICENSE",
          "token": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d"
        }, {
          "path": "meta-inf/LICENSE",
          "token": "d9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d"
        }]
      }

      const result = definitionLicenseMatchPolicy.compare(
        { definition: { ...sourceDefinition, coordinates } },
        { definition: { ...targetDefinition, coordinates } }
      )

      expect(result.match).to.have.lengthOf(2).and.have.deep.members([{
        policy: definitionLicenseMatchPolicy.name,
        file: 'meta-inf/LICENSE',
        propPath: 'token',
        value: 'd9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d',
      }, {
        policy: definitionLicenseMatchPolicy.name,
        file: 'LICENSE',
        propPath: 'token',
        value: 'd9fccda7d1daaec4c1a84d46b48d808e56ee8979c1b62ccc1492b7c27ab7010d'
      }])
      expect(result.mismatch).to.have.lengthOf(0)
    })
  })

  // Even though some matching props are the same for different package type.
  // However, the value of the props are various. Therefore, it's better to test based on type
  describe('HarvestLicenseMatchPolicy compare()', () => {
    const harvestLicenseMatchPolicy = new HarvestLicenseMatchPolicy();
    describe('Match maven package', () => {
      const sourceLicenses = [
        {
          "license": [
            {
              "name": [
                "The Apache License, Version 2.0"
              ],
              "url": [
                "http://www.apache.org/licenses/LICENSE-2.0.txt"
              ]
            }
          ]
        }
      ]
      function generateMavenDefinitionAndHarvest(revision, licenses) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`maven/mavencentral/io.opentelemetry/opentelemetry-sdk-common/${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.5.0": {
                "manifest": {
                  "summary": {
                    "licenses": licenses
                  }
                }
              },
              "1.3.1": {}
            }
          }
        }
      }

      it('Should return match array includes harvest manifest.summary.licenses when they are deep equal', () => {
        const source = generateMavenDefinitionAndHarvest('1.0.0', sourceLicenses)
        const target = generateMavenDefinitionAndHarvest('2.0.0', sourceLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'manifest.summary.licenses',
          value: sourceLicenses
        })
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest manifest.summary.licenses when they are NOT deep equal', () => {
        const targetLicenses = [
          {
            "license": [
              {
                "name": [
                  "MIT"
                ],
                "url": [
                  "https://opensource.org/licenses/MIT"
                ]
              }
            ]
          }
        ]
        const source = generateMavenDefinitionAndHarvest('1.0.0', sourceLicenses)
        const target = generateMavenDefinitionAndHarvest('2.0.0', targetLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'manifest.summary.licenses',
          source: sourceLicenses,
          target: targetLicenses
        })
      })

      it('Should return empty match and mismatch array when harvest manifest.summary.licenses are both undefined/null', () => {
        const source = generateMavenDefinitionAndHarvest('1.0.0')
        const target = generateMavenDefinitionAndHarvest('2.0.0')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })

    describe('Match crate package', () => {
      const sourceLicense = 'MIT OR Apache-2.0'

      function generateCrateDefinitionAndHarvest(revision, license) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`crate/cratesio/-/libc/${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.2.0": {
                "registryData": {
                  "license": license
                }
              }
            }
          }
        }
      }

      it('Should return match array includes harvest registryData.license when they are deep equal', () => {
        const source = generateCrateDefinitionAndHarvest('0.2.86', sourceLicense)
        const target = generateCrateDefinitionAndHarvest('0.2.49', sourceLicense)
        const result = harvestLicenseMatchPolicy.compare(source, target)

        expect(result.match).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.license',
          value: sourceLicense
        })
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest registryData.license when they are NOT deep equal', () => {
        const targetLicense = 'MIT AND Apache-2.0'
        const source = generateCrateDefinitionAndHarvest('0.2.86', sourceLicense)
        const target = generateCrateDefinitionAndHarvest('0.2.49', targetLicense)
        const result = harvestLicenseMatchPolicy.compare(source, target)

        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.license',
          source: sourceLicense,
          target: targetLicense
        })
      })

      it('Should return empty match and mismatch array when harvest manifest.summary.licenses are both undefined/null', () => {
        const source = generateCrateDefinitionAndHarvest('0.2.86')
        const target = generateCrateDefinitionAndHarvest('0.2.49')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })

    describe('Match nuget package', () => {
      const sourceLicense = 'MIT'
      const sourceLicenseUrl = 'https://licenses.nuget.org/MIT'
      function generateNugetDefinitionAndHarvest(revision, license, licenseUrl) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`nuget/nuget/-/Microsoft.Identity.Web.MicrosoftGraph/${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.4.2": {
                "manifest": {
                  "licenseUrl": licenseUrl,
                  "licenseExpression": license
                }
              }
            }
          }
        }
      }

      it('Should return match array includes both harvest manifest.licenseExpression and manifest.licenseUrl when both are the same', () => {
        const source = generateNugetDefinitionAndHarvest('1.4.0', sourceLicense, sourceLicenseUrl)
        const target = generateNugetDefinitionAndHarvest('1.4.6', sourceLicense, sourceLicenseUrl)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(2).and.have.deep.members([{
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'manifest.licenseExpression',
          value: sourceLicense
        }, {
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'manifest.licenseUrl',
          value: sourceLicenseUrl
        }])
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest manifest.licenseExpression when they are NOT deep equal', () => {
        const targetLicense = 'Apache-2.0'
        const source = generateNugetDefinitionAndHarvest('1.4.0', sourceLicense)
        const target = generateNugetDefinitionAndHarvest('1.4.6', targetLicense)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.mismatch).to.have.lengthOf(1).and.have.deep.members([{
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'manifest.licenseExpression',
          source: sourceLicense,
          target: targetLicense
        }])
      })

      it('Should return mismatch array includes harvest manifest.licenseUrl when they are NOT deep equal', () => {
        const targetLicenseUrl = 'https://licenses.nuget.org/Apache-2.0'
        const source = generateNugetDefinitionAndHarvest('1.4.0', undefined, sourceLicenseUrl)
        const target = generateNugetDefinitionAndHarvest('1.4.6', undefined, targetLicenseUrl)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.mismatch).to.have.lengthOf(1).and.have.deep.members([{
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'manifest.licenseUrl',
          source: sourceLicenseUrl,
          target: targetLicenseUrl
        }])
      })

      it('Should return empty match and mismatch array when harvest manifest.licenseExpression and manifest.licenseUrl are both undefined/null', () => {
        const source = generateNugetDefinitionAndHarvest('0.2.86')
        const target = generateNugetDefinitionAndHarvest('0.2.49')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })

    describe('Match npm package', () => {
      const sourceLicense = 'MIT'
      function generateNpmDefinitionAndHarvest(revision, license) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`npm/npmjs/-/mongoose/${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.1.2": {
                "registryData": {
                  "manifest": {
                    "license": license
                  }
                }
              }
            }
          }
        }
      }

      it('Should return match array includes harvest registryData.manifest.license when they are deep equal', () => {
        const source = generateNpmDefinitionAndHarvest('5.2.5', sourceLicense)
        const target = generateNpmDefinitionAndHarvest('4.2.7', sourceLicense)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.manifest.license',
          value: sourceLicense
        })
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest registryData.manifest.license when they are NOT deep equal', () => {
        const targetLicense = "Apache-2.0"
        const source = generateNpmDefinitionAndHarvest('5.2.5', sourceLicense)
        const target = generateNpmDefinitionAndHarvest('4.2.7', targetLicense)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.manifest.license',
          source: sourceLicense,
          target: targetLicense
        })
      })

      it('Should return empty match and mismatch array when harvest manifest.manifest.license are both undefined/null', () => {
        const source = generateNpmDefinitionAndHarvest('5.2.5')
        const target = generateNpmDefinitionAndHarvest('4.2.7')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })

    describe('Match composer package', () => {
      const sourceLicenses = [
        "GPL-2.0+"
      ]
      function generateComposerDefinitionAndHarvest(revision, licenses) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`composer/packagist/codeinwp/themeisle-sdk/$${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.2.0": {
                "registryData": {
                  "manifest": {
                    "license": licenses
                  }
                }
              }
            }
          }
        }
      }

      it('Should return match array includes harvest registryData.manifest.license when they are deep equal', () => {
        const source = generateComposerDefinitionAndHarvest('3.2.9', sourceLicenses)
        const target = generateComposerDefinitionAndHarvest('3.1.9', sourceLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.manifest.license',
          value: sourceLicenses
        })
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest registryData.manifest.license when they are NOT deep equal', () => {
        const targetLicenses = [
          "GPL-2.0"
        ]
        const source = generateComposerDefinitionAndHarvest('3.2.9', sourceLicenses)
        const target = generateComposerDefinitionAndHarvest('3.1.9', targetLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.manifest.license',
          source: sourceLicenses,
          target: targetLicenses
        })
      })

      it('Should return empty match and mismatch array when harvest registryData.manifest.licenses are both undefined/null', () => {
        const source = generateComposerDefinitionAndHarvest('3.2.9')
        const target = generateComposerDefinitionAndHarvest('3.1.9')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })

    describe('Match gem package', () => {
      const sourceLicenses = [
        "Ruby"
      ]
      function generateGemDefinitionAndHarvest(revision, licenses) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`gem/rubygems/-/reline/${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.3.3": {
                "registryData": {
                  "licenses": licenses
                }
              }
            }
          }
        }
      }

      it('Should return match array includes harvest registryData.licenses when they are deep equal', () => {
        const source = generateGemDefinitionAndHarvest('0.2.1', sourceLicenses)
        const target = generateGemDefinitionAndHarvest('0.1.1', sourceLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.licenses',
          value: sourceLicenses
        })
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest registryData.licenses when they are NOT deep equal', () => {
        const targetLicenses = [
          "Ruby License"
        ]
        const source = generateGemDefinitionAndHarvest('0.2.1', sourceLicenses)
        const target = generateGemDefinitionAndHarvest('0.1.1', targetLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.licenses',
          source: sourceLicenses,
          target: targetLicenses
        })
      })

      it('Should return empty match and mismatch array when harvest manifest.manifest.license are both undefined/null', () => {
        const source = generateGemDefinitionAndHarvest('0.2.1')
        const target = generateGemDefinitionAndHarvest('0.1.1')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })

    describe('Match pypi package', () => {
      const sourceLicenseInfo = 'BSD'
      const sourceDeclaredLicense = 'BSD-2-Clause'
      function generatePypiDefinitionAndHarvest(revision, licenseInfo, declaredLicense) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`pypi/pypi/-/distributed/${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.3.1": {
                "registryData": {
                  "info": {
                    "license": licenseInfo
                  }
                },
                "declaredLicense": declaredLicense
              }
            }
          }
        }
      }

      it('Should return match array includes both harvest declaredLicense and registryData.info.license when both are the same', () => {
        const source = generatePypiDefinitionAndHarvest('2021.1.0', sourceLicenseInfo, sourceDeclaredLicense)
        const target = generatePypiDefinitionAndHarvest('1.25.3', sourceLicenseInfo, sourceDeclaredLicense)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(2).and.have.deep.members([{
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.info.license',
          value: sourceLicenseInfo
        }, {
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'declaredLicense',
          value: sourceDeclaredLicense
        }])
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest declaredLicense when they are NOT deep equal', () => {
        const targetDeclaredLicense = 'BSD-3-Clause'
        const source = generatePypiDefinitionAndHarvest('2021.1.0', undefined, sourceDeclaredLicense)
        const target = generatePypiDefinitionAndHarvest('1.25.3', undefined, targetDeclaredLicense)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.mismatch).to.have.lengthOf(1).and.have.deep.members([{
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'declaredLicense',
          source: sourceDeclaredLicense,
          target: targetDeclaredLicense
        }])
      })

      it('Should return mismatch array includes harvest registryData.info.license when they are NOT deep equal', () => {
        const targetLicenseInfo = 'Apache-2.0'
        const source = generatePypiDefinitionAndHarvest('2021.1.0', sourceLicenseInfo)
        const target = generatePypiDefinitionAndHarvest('1.25.3', targetLicenseInfo)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.mismatch).to.have.lengthOf(1).and.have.deep.members([{
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'registryData.info.license',
          source: sourceLicenseInfo,
          target: targetLicenseInfo
        }])
      })

      it('Should return empty match and mismatch array when harvest declaredLicense and registryData.info.license are both undefined/null', () => {
        const source = generatePypiDefinitionAndHarvest('2021.1.0')
        const target = generatePypiDefinitionAndHarvest('1.25.3')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })

    describe('Match deb package', () => {
      const sourceLicenses = [
        "AGPL-3",
        "MIT",
        "BSD-3-clause",
        "(GPL-3 OR AGPL-3)",
        "PSF-2",
        "GPL-3"
      ]
      function generateDebDefinitionAndHarvest(revision, licenses) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`deb/debian/-/kopano-contacts/${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.2.1": {
                "declaredLicenses": licenses
              }
            }
          }
        }
      }

      it('Should return match array includes harvest declaredLicenses when they are deep equal', () => {
        const source = generateDebDefinitionAndHarvest('8.7.0-4_s390x', sourceLicenses)
        const target = generateDebDefinitionAndHarvest('8.7.0-4_i386', sourceLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'declaredLicenses',
          value: sourceLicenses
        })
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest declaredLicense when they are NOT deep equal', () => {
        const targetLicenses = [
          "MIT",
          "BSD-3-clause",
          "(GPL-3 OR AGPL-3)",
          "PSF-2",
          "GPL-3"
        ]
        const source = generateDebDefinitionAndHarvest('8.7.0-4_s390x', sourceLicenses)
        const target = generateDebDefinitionAndHarvest('8.7.0-3_amd64', targetLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'declaredLicenses',
          source: sourceLicenses,
          target: targetLicenses
        })
      })

      it('Should return empty match and mismatch array when harvest declaredLicense are both undefined/null', () => {
        const source = generateDebDefinitionAndHarvest('8.7.0-4_s390x')
        const target = generateDebDefinitionAndHarvest('8.7.0-3_amd64')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })

    describe('Match debsrc package', () => {
      const sourceLicenses = [
        "GPL-3.0+",
        "MIT",
        "GPL-2.0+",
        "AGPL-3.0",
        "BSD-3-clause"
      ]
      function generateDebDefinitionAndHarvest(revision, licenses) {
        return {
          definition: {
            coordinates: EntityCoordinates.fromString(`debsrc/debian/-/lava/${revision}`)
          },
          harvest: {
            "clearlydefined": {
              "1.3.1": {
                "declaredLicenses": licenses
              }
            }
          }
        }
      }

      it('Should return match array includes harvest declaredLicenses when they are deep equal', () => {
        const source = generateDebDefinitionAndHarvest('2019.10-1', sourceLicenses)
        const target = generateDebDefinitionAndHarvest('2019.10-2', sourceLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'declaredLicenses',
          value: sourceLicenses
        })
        expect(result.mismatch).to.have.lengthOf(0)
      })

      it('Should return mismatch array includes harvest declaredLicense when they are NOT deep equal', () => {
        const targetLicenses = [
          "MIT",
          "GPL-2.0+",
          "AGPL-3.0",
          "BSD-3-clause"
        ]
        const source = generateDebDefinitionAndHarvest('2019.10-1', sourceLicenses)
        const target = generateDebDefinitionAndHarvest('2019.10-2', targetLicenses)
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(1).and.deep.include({
          policy: harvestLicenseMatchPolicy.name,
          propPath: 'declaredLicenses',
          source: sourceLicenses,
          target: targetLicenses
        })
      })

      it('Should return empty match and mismatch array when harvest declaredLicense are both undefined/null', () => {
        const source = generateDebDefinitionAndHarvest('2019.10-1')
        const target = generateDebDefinitionAndHarvest('2019.10-2')
        const result = harvestLicenseMatchPolicy.compare(source, target)
        expect(result.match).to.have.lengthOf(0)
        expect(result.mismatch).to.have.lengthOf(0)
      })
    })
  })
})