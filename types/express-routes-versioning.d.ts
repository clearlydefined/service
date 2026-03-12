// Type definitions for express-routes-versioning
declare module 'express-routes-versioning' {
  import type { RequestHandler } from 'express'
  function routesVersioning(): (versions: Record<string, RequestHandler>, fallback?: RequestHandler) => RequestHandler
  export = routesVersioning
}
