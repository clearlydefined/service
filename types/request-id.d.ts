// Type definitions for request-id
declare module 'request-id/express' {
  import type { RequestHandler } from 'express'
  function requestId(options?: { value?: () => string; reqHeader?: string; resHeader?: string }): RequestHandler
  export = requestId
}
