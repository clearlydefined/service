// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const { sanitizeHeaders, sanitizeMeta, buildProperties } = require('../../../providers/logging/winstonConfig')

describe('sanitizeHeaders', () => {
  it('should return empty object for undefined', () => {
    const result = sanitizeHeaders(undefined)
    expect(result).to.deep.equal({})
  })

  it('should return empty object for null', () => {
    const result = sanitizeHeaders(null)
    expect(result).to.deep.equal({})
  })

  it('should return empty object for empty object', () => {
    const result = sanitizeHeaders({})
    expect(result).to.deep.equal({})
  })

  it('should pass through non-sensitive headers unchanged', () => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Request-Id': '12345'
    }
    const result = sanitizeHeaders(headers)
    expect(result).to.deep.equal(headers)
  })

  it('should redact x-api-key header', () => {
    const headers = { 'x-api-key': 'secret-key' }
    const result = sanitizeHeaders(headers)
    expect(result).to.deep.equal({ 'x-api-key': '<REDACTED>' })
  })

  it('should redact authorization header', () => {
    const headers = { authorization: 'Bearer token123' }
    const result = sanitizeHeaders(headers)
    expect(result).to.deep.equal({ authorization: '<REDACTED>' })
  })

  it('should redact proxy-authorization header', () => {
    const headers = { 'proxy-authorization': 'Basic xyz' }
    const result = sanitizeHeaders(headers)
    expect(result).to.deep.equal({ 'proxy-authorization': '<REDACTED>' })
  })

  it('should redact cookie header', () => {
    const headers = { cookie: 'session=abc123' }
    const result = sanitizeHeaders(headers)
    expect(result).to.deep.equal({ cookie: '<REDACTED>' })
  })

  it('should handle case-insensitive header names', () => {
    const headers = {
      Authorization: 'Bearer token',
      'X-API-KEY': 'secret',
      Cookie: 'session=123'
    }
    const result = sanitizeHeaders(headers)
    expect(result).to.deep.equal({
      Authorization: '<REDACTED>',
      'X-API-KEY': '<REDACTED>',
      Cookie: '<REDACTED>'
    })
  })

  it('should redact sensitive headers while preserving non-sensitive ones', () => {
    const headers = {
      'Content-Type': 'application/json',
      authorization: 'Bearer secret',
      'x-api-key': 'api-secret',
      Accept: 'application/json'
    }
    const result = sanitizeHeaders(headers)
    expect(result).to.deep.equal({
      'Content-Type': 'application/json',
      authorization: '<REDACTED>',
      'x-api-key': '<REDACTED>',
      Accept: 'application/json'
    })
  })
})

describe('sanitizeMeta', () => {
  /** @type {ReturnType<typeof sanitizeMeta>} */
  let format

  beforeEach(() => {
    format = sanitizeMeta()
  })

  describe('HTTP request sanitization', () => {
    it('should summarize req object', () => {
      const info = {
        level: 'info',
        message: 'test',
        req: {
          method: 'GET',
          originalUrl: '/api/test',
          id: 'req-123',
          headers: { 'x-correlation-id': 'corr-456' },
          socket: { circular: 'reference' }
        }
      }

      const result = format.transform(info)

      expect(result.req).to.deep.equal({
        method: 'GET',
        url: '/api/test',
        requestId: 'req-123',
        correlationId: 'corr-456'
      })
    })

    it('should use url if originalUrl is not present', () => {
      const info = {
        level: 'info',
        message: 'test',
        req: {
          method: 'POST',
          url: '/api/fallback',
          id: 'req-789'
        }
      }

      const result = format.transform(info)

      expect(result.req.url).to.equal('/api/fallback')
    })

    it('should handle req without headers', () => {
      const info = {
        level: 'info',
        message: 'test',
        req: {
          method: 'GET',
          url: '/test'
        }
      }

      const result = format.transform(info)

      expect(result.req).to.deep.equal({
        method: 'GET',
        url: '/test',
        requestId: undefined,
        correlationId: undefined
      })
    })
  })

  describe('HTTP response sanitization', () => {
    it('should summarize res object', () => {
      const info = {
        level: 'info',
        message: 'test',
        res: {
          statusCode: 200,
          socket: { circular: 'reference' },
          _header: 'HTTP/1.1 200 OK'
        }
      }

      const result = format.transform(info)

      expect(result.res).to.deep.equal({
        statusCode: 200
      })
    })
  })

  describe('generic request/response aliases', () => {
    it('should replace request field when req is not present', () => {
      const info = {
        level: 'info',
        message: 'test',
        request: { some: 'data', circular: {} }
      }

      const result = format.transform(info)

      expect(result.request).to.equal('[request omitted]')
    })

    it('should replace response field when res is not present', () => {
      const info = {
        level: 'info',
        message: 'test',
        response: { some: 'data', circular: {} }
      }

      const result = format.transform(info)

      expect(result.response).to.equal('[response omitted]')
    })

    it('should not replace request field when req is present', () => {
      const info = {
        level: 'info',
        message: 'test',
        req: { method: 'GET', url: '/test' },
        request: { some: 'data' }
      }

      const result = format.transform(info)

      expect(result.request).to.deep.equal({ some: 'data' })
    })

    it('should not replace response field when res is present', () => {
      const info = {
        level: 'info',
        message: 'test',
        res: { statusCode: 200 },
        response: { some: 'data' }
      }

      const result = format.transform(info)

      expect(result.response).to.deep.equal({ some: 'data' })
    })
  })

  describe('Axios config sanitization', () => {
    it('should summarize config object', () => {
      const info = {
        level: 'info',
        message: 'test',
        config: {
          method: 'post',
          url: 'https://api.example.com/data',
          headers: {
            'Content-Type': 'application/json',
            authorization: 'Bearer secret'
          },
          data: { payload: 'data' },
          transformRequest: [function () {}]
        }
      }

      const result = format.transform(info)

      expect(result.config).to.deep.equal({
        method: 'post',
        url: 'https://api.example.com/data',
        headers: {
          'Content-Type': 'application/json',
          authorization: '<REDACTED>'
        }
      })
    })

    it('should handle config with null headers', () => {
      const info = {
        level: 'info',
        message: 'test',
        config: {
          method: 'get',
          url: 'https://api.example.com',
          headers: null
        }
      }

      const result = format.transform(info)

      expect(result.config).to.deep.equal({
        method: 'get',
        url: 'https://api.example.com',
        headers: {}
      })
    })

    it('should handle config with undefined headers', () => {
      const info = {
        level: 'info',
        message: 'test',
        config: {
          method: 'get',
          url: 'https://api.example.com'
        }
      }

      const result = format.transform(info)

      expect(result.config).to.deep.equal({
        method: 'get',
        url: 'https://api.example.com',
        headers: {}
      })
    })
  })

  describe('passthrough behavior', () => {
    it('should pass through info without req/res/config unchanged', () => {
      const info = {
        level: 'info',
        message: 'test message',
        customField: 'value'
      }

      const result = format.transform(info)

      expect(result).to.deep.equal(info)
    })

    it('should preserve other metadata fields', () => {
      const info = {
        level: 'error',
        message: 'error occurred',
        req: { method: 'GET', url: '/test' },
        error: 'Something went wrong',
        userId: 'user-123'
      }

      const result = format.transform(info)

      expect(result.error).to.equal('Something went wrong')
      expect(result.userId).to.equal('user-123')
    })
  })
})

describe('buildProperties', () => {
  const createNullProtoDict = (entries = {}) => Object.assign(Object.create(null), entries)
  const withThrowingGetter = (dict = createNullProtoDict()) => {
    const getter = () => {
      throw new Error('nope')
    }
    Object.defineProperty(dict, 'x', { enumerable: true, get: getter })
    return dict
  }

  it('rehydrates null-prototype dictionary to plain object', () => {
    const info = { requestParams: createNullProtoDict({ foo: 'bar' }) }
    const result = buildProperties(info)
    expect(result.requestParams).to.deep.equal({ foo: 'bar' })
    expect(Object.getPrototypeOf(result.requestParams)).to.equal(Object.prototype)
  })

  it('leaves plain objects unchanged (by reference)', () => {
    const obj = { a: 1, b: 'x' }
    const result = buildProperties({ meta: obj })
    expect(result.meta).to.equal(obj)
  })

  it('passes through arrays and primitives', () => {
    const info = { list: [1, 2, 3], s: 'str', n: 42, b: true, u: undefined, nl: null }
    const result = buildProperties(info)
    expect(result).to.deep.equal(info)
  })

  it('falls back to "[unserializable object]" when getter throws on null-prototype', () => {
    const dict = withThrowingGetter()
    const result = buildProperties({ requestParams: dict })
    expect(result.requestParams).to.equal('[unserializable object]')
  })

  it('uses JSON.stringify via toJSON when assign fails but stringify succeeds', () => {
    const dict = withThrowingGetter()
    Object.defineProperty(dict, 'toJSON', { value: () => ({ safe: 'ok' }) })
    const result = buildProperties({ requestParams: dict })
    expect(result.requestParams).to.equal(JSON.stringify({ safe: 'ok' }))
  })

  it('does not process nested null-prototype objects (shallow only)', () => {
    const nested = createNullProtoDict({ a: 'b' })
    const parent = { child: nested }
    const result = buildProperties({ parent })
    expect(result.parent.child).to.equal(nested)
  })
})
