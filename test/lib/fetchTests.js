const { fail } = require('assert')
const { callFetch, withDefaults, defaultHeaders } = require('../../lib/fetch')
const { expect } = require('chai')
const fs = require('fs')
const mockttp = require('mockttp')

function checkDefaultHeaders(headers) {
  for (const [key, value] of Object.entries(defaultHeaders)) {
    expect(headers).to.have.property(key.toLowerCase()).that.equals(value)
  }
}

describe('CallFetch', () => {
  describe('with mock server', () => {
    const mockServer = mockttp.getLocal()
    beforeEach(async () => await mockServer.start())
    afterEach(async () => await mockServer.stop())

    it('checks if the response is JSON while sending GET request', async () => {
      const path = '/registry.npmjs.com/redis/0.1.0'
      const expected = fs.readFileSync('test/fixtures/fetch/redis-0.1.0.json')
      await mockServer.forGet(path).thenReply(200, expected)

      const response = await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET',
        json: true
      })
      expect(response).to.be.deep.equal(JSON.parse(expected))
    })

    it('checks if all the default headers are present in requests', async () => {
      const path = '/search.maven.org/solrsearch/select';
      const exactQuery = '?q=g:org.httpcomponents+AND+a:httpcomponents&core=gav&rows=100&wt=json';
      
      const endpointMock = await mockServer.forGet(path).withExactQuery(exactQuery).thenReply(200, 'success');

      await callFetch({
      url: mockServer.urlFor(path + exactQuery),
      method: 'GET',
      json: true
      });
      
      const requests = await endpointMock.getSeenRequests();
      checkDefaultHeaders(requests[0].headers);
      
      });

    it('checks if all the default headers and other specific header is present in crate component', async () => {
      const path = '/crates.io/api/v1/crates/name'
      const endpointMock = await mockServer.forGet(path).thenReply(200, 'success')

      await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET',
        json: true,
        encoding: null,
        headers: {
          Accept: 'text/html'
        }
      })
      const requests = await endpointMock.getSeenRequests()
      checkDefaultHeaders(requests[0].headers)
      expect(requests[0].headers).to.include({ accept: 'text/html' })
    })

    it('checks if the full response is fetched', async () => {
      const path = '/registry.npmjs.com/redis/0.1.0'
      const expected = fs.readFileSync('test/fixtures/fetch/redis-0.1.0.json')
      await mockServer.forGet(path).thenReply(200, expected)

      const response = await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET',
        resolveWithFullResponse: true
      })
      expect(response.statusCode).to.be.equal(200)
      expect(response.statusMessage).to.be.equal('OK')
    })

    it('should throw error with error code', async () => {
      const path = '/registry.npmjs.com/redis/0.1.'
      await mockServer.forGet(path).thenReply(404)
      try {
        await callFetch({
          url: mockServer.urlFor(path),
          method: 'GET',
          json: 'true',
          resolveWithFullResponse: true
        })
        fail('should have thrown')
      } catch (err) {
        expect(err.statusCode).to.be.equal(404)
      }
    })

    it('checks if the response is text while sending GET request', async () => {
      const path = '/proxy.golang.org/rsc.io/quote/@v/v1.3.0.mod'
      await mockServer.forGet(path).thenReply(200, 'module "rsc.io/quote"\n')

      const response = await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET'
      })
      expect(response).to.be.equal('module "rsc.io/quote"\n')
    })

    it('should download stream successfully with GET request', async () => {
      const expected = JSON.parse(fs.readFileSync('test/fixtures/fetch/redis-0.1.0.json'))
      const path = '/registry.npmjs.com/redis/0.1.0'
      await mockServer.forGet(path).thenStream(200, fs.createReadStream('test/fixtures/fetch/redis-0.1.0.json'))

      const response = await callFetch({
        url: mockServer.urlFor(path),
        encoding: null
      })
      const destination = 'test/fixtures/fetch/temp.json'
      await new Promise(resolve => {
        response.pipe(fs.createWriteStream(destination).on('finish', () => resolve(true)))
      })
      const downloaded = JSON.parse(fs.readFileSync(destination))
      expect(downloaded).to.be.deep.equal(expected)
      fs.unlinkSync(destination)
    })

    it('should apply default headers ', async () => {
      const path = '/registry.npmjs.com/redis/0.1.0'
      const url = mockServer.urlFor(path)
      const endpointMock = await mockServer.forGet(path).thenReply(200)

      const defaultOptions = { headers: defaultHeaders }
      const requestWithDefaults = withDefaults(defaultOptions)
      await requestWithDefaults({ url })
      await requestWithDefaults({ url })

      const requests = await endpointMock.getSeenRequests()
      expect(requests.length).to.equal(2)
      expect(requests[0].url).to.equal(url)
      checkDefaultHeaders(requests[0].headers)
      expect(requests[1].url).to.equal(url)
      checkDefaultHeaders(requests[1].headers)
    })

    it('checks if the response is text with uri option in GET request', async () => {
      const path = '/proxy.golang.org/rsc.io/quote/@v/v1.3.0.mod'
      await mockServer.forGet(path).thenReply(200, 'done')

      const response = await callFetch({
        uri: mockServer.urlFor(path),
        method: 'GET'
      })
      expect(response).to.be.equal('done')
    })

    it('should POST with JSON', async function () {
      const path = '/webhook'
      const endpointMock = await mockServer.forPost(path).thenReply(200, 'done')

      const response = await callFetch({
        method: 'POST',
        uri: mockServer.urlFor(path),
        json: true,
        body: { test: 'test' },
        headers: { 'x-crawler': 'secret' },
        resolveWithFullResponse: true
      })
      expect(response.statusCode).to.be.equal(200)
      const requests = await endpointMock.getSeenRequests()
      expect(requests.length).to.equal(1)
      const json = await requests[0].body.getJson()
      expect(json).to.deep.equal({ test: 'test' })
      expect(requests[0].headers).to.include({ 'x-crawler': 'secret' })
      expect(checkDefaultHeaders(requests[0].headers))
    })

    it('should GET with withCredentials set to false', async function () {
      const path = '/indexes/definitionsindexer/docs/suggest'
      await mockServer.forGet(path).thenReply(200, 'done')

      const response = await callFetch({
        method: 'GET',
        url: mockServer.urlFor(path),
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: false,
        simple: false,
        resolveWithFullResponse: true,
        json: true
      })
      expect(response.statusCode).to.be.equal(200)
      expect(response.config.withCredentials).to.be.false
    })

    it('should POST with withCredentials set to false', async function () {
      const path = '/v1/apps/serviceid/query'
      await mockServer.forPost(path).thenReply(200, 'done')
      const query = `
      traces
      | where timestamp > ago(90d) 
      | where customDimensions.outcome == 'Processed'  
      | where strlen(customDimensions.crawlerHost) > 0
      | parse message with "Processed " tool "@cd:/" type "/" specTrail 
      | summarize count() by when=bin(timestamp, 1d), tool
      | order by when asc, tool`

      const response = await callFetch({
        method: 'POST',
        url: mockServer.urlFor(path),
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: { query },
        withCredentials: false,
        json: true,
        resolveWithFullResponse: true
      })
      expect(response.statusCode).to.be.equal(200)
      expect(response.config.withCredentials).to.be.false
    })

    describe('test simple', () => {
      it('should handle 300 when simple is true by default', async () => {
        const path = '/registry.npmjs.com/redis/0.1.0'
        await mockServer.forGet(path).thenReply(300, 'test')

        try {
          await callFetch({ url: mockServer.urlFor(path) })
          fail('should have thrown')
        } catch (err) {
          expect(err.statusCode).to.be.equal(300)
        }
      })

      it('should handle 300 with simple === false', async () => {
        const path = '/registry.npmjs.com/redis/0.1.0'
        await mockServer.forGet(path).thenReply(300, 'test')

        const response = await callFetch({
          url: mockServer.urlFor(path),
          simple: false
        })
        expect(response).to.be.equal('test')
      })

      it('should return status 300 with simple === false', async () => {
        const path = '/registry.npmjs.com/redis/0.1.0'
        await mockServer.forGet(path).thenReply(300, 'test')

        const response = await callFetch({
          url: mockServer.urlFor(path),
          simple: false,
          resolveWithFullResponse: true
        })
        expect(response.statusCode).to.be.equal(300)
        expect(response.statusMessage).to.be.equal('Multiple Choices')
      })
    })
  })
})
