/**
 * Custom type definitions for winston-azure-application-insights package. This package provides an Azure Application
 * Insights transport for Winston logging.
 *
 * @see https://github.com/bragma/winston-azure-application-insights
 */

declare module 'winston-azure-application-insights' {
  import * as winston from 'winston'
  import * as appInsights from 'applicationinsights'

  /** Winston log levels mapped to Application Insights severity levels. */
  type WinstonLevel =
    | 'emerg'
    | 'alert'
    | 'crit'
    | 'error'
    | 'warning'
    | 'warn'
    | 'notice'
    | 'info'
    | 'verbose'
    | 'debug'
    | 'silly'

  /** Application Insights track method names. */
  type TrackMethodName = 'trackTrace' | 'trackException'

  /**
   * Formatter function type for customizing log output before sending to Application Insights. This follows Winston's
   * standard formatter signature.
   *
   * @param options - The Winston log options object containing level, message, meta, etc.
   * @returns The formatted string to be sent to Application Insights
   */
  type FormatterFunction = (options?: any) => string

  /** Configuration options for the Azure Application Insights logger transport. */
  interface AzureApplicationInsightsLoggerOptions extends winston.GenericTransportOptions {
    /** Application Insights instrumentation key. If not provided, the SDK will expect an environment variable to be set. */
    key?: string

    /**
     * Pre-configured Application Insights client instance. If provided, this client will be used instead of creating a
     * new one.
     */
    client?: appInsights.TelemetryClient

    /** Application Insights instance with a configured default client. If provided, the default client will be used. */
    insights?: typeof appInsights

    /**
     * Whether to treat error-level logs as exceptions in Application Insights. When true, errors will be tracked as
     * exceptions instead of traces.
     *
     * @default false
     */
    treatErrorsAsExceptions?: boolean

    /**
     * Custom formatter function to modify log data before sending to Application Insights.
     *
     * @default defaultFormatter
     */
    formatter?: FormatterFunction

    /**
     * Whether to exit on error.
     *
     * @default false
     */
    exitOnError?: boolean
  }

  /** Azure Application Insights transport instance for Winston logger. */
  interface AzureApplicationInsightsLoggerInstance extends winston.TransportInstance {
    /** The Application Insights client instance used for logging. */
    client: appInsights.TelemetryClient

    /** The name of this transport. */
    name: string

    /** Whether to treat error-level logs as exceptions. */
    treatErrorsAsExceptions: boolean

    /** The formatter function used to modify log data. */
    formatter: FormatterFunction

    /**
     * Creates a new Azure Application Insights logger transport.
     *
     * @param options - Configuration options for the transport
     * @throws {Error} When unable to get an Application Insights client instance
     */
    new (options?: AzureApplicationInsightsLoggerOptions): AzureApplicationInsightsLoggerInstance
  }

  /**
   * Maps Winston log levels to Application Insights severity levels.
   *
   * @param winstonLevel - The Winston log level to map
   * @returns The corresponding Application Insights severity level
   */
  function getMessageLevel(winstonLevel: WinstonLevel): appInsights.Contracts.SeverityLevel

  /**
   * Default formatter function that converts Winston log options to a string. This is the standard Winston formatter
   * behavior.
   *
   * @param options - The Winston log options object
   * @returns The formatted log string
   */
  function defaultFormatter(options?: any): string

  // Export the transport constructor for use with winston.add()
  export const AzureApplicationInsightsLogger: AzureApplicationInsightsLoggerInstance
  export { getMessageLevel, defaultFormatter }
}
