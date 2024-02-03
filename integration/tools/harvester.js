const { callFetch, buildPostOpts } = require('./fetch')

const defaultToolChecks = [
  ['licensee', '9.14.0'],
  ['scancode', '30.3.0'],
  ['reuse', '3.2.1']
]

class Harvester {
  constructor(apiBaseUrl, harvestToolChecks) {
    this.apiBaseUrl = apiBaseUrl
    this.harvestToolChecks = harvestToolChecks || defaultToolChecks
  }

  async harvest(components, reharvest = false) {
    return await callFetch(`${this.apiBaseUrl}/harvest`, buildPostOpts(this._buildPostJson(components, reharvest)))
  }

  _buildPostJson(components, reharvest = false) {
    return components.map(coordinates => {
      const result = { tool: 'component', coordinates }
      if (reharvest) result.policy = 'always'
      return result
    })
  }

  async pollForCompletion(components, poller, startTime) {
    const status = new Map()
    for (const coordinates of components) {
      const completed = await this._pollForOneCompletion(coordinates, poller, startTime)
      status.set(coordinates, completed)
    }

    for (const coordinates of components) {
      const completed = status.get(coordinates) || (await this.isHarvestComplete(coordinates, startTime))
      status.set(coordinates, completed)
    }
    return status
  }

  async _pollForOneCompletion(coordinates, poller, startTime) {
    try {
      const completed = await poller.poll(async () => this.isHarvestComplete(coordinates, startTime))
      console.log(`Completed ${coordinates}: ${completed}`)
      return completed
    } catch (e) {
      console.error(`Failed to wait for harvest completion ${coordinates}: ${e.message}`)
      return false
    }
  }

  async isHarvestComplete(coordinates, startTime) {
    const harvestChecks = this.harvestToolChecks.map(([tool, toolVersion]) =>
      this.isHarvestedbyTool(coordinates, tool, toolVersion, startTime)
    )

    return Promise.all(harvestChecks)
      .then(results => results.every(r => r))
      .catch(() => false)
  }

  async isHarvestedbyTool(coordinates, tool, toolVersion, startTime = 0) {
    const harvested = await this.fetchHarvestResult(coordinates, tool, toolVersion)
    if (!harvested._metadata) return false
    const fetchedAt = new Date(harvested._metadata.fetchedAt)
    console.log(`${coordinates} ${tool}, ${toolVersion} fetched at ${fetchedAt}`)
    return fetchedAt.getTime() > startTime
  }

  async fetchHarvestResult(coordinates, tool, toolVersion) {
    return callFetch(`${this.apiBaseUrl}/harvest/${coordinates}/${tool}/${toolVersion}?form=raw`)
      .then(r => r.json())
      .catch(() => ({}))
  }
}

module.exports = Harvester
