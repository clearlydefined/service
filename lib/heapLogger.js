// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// ===================================================
// Log the heap statistics at regular intervals
// ===================================================
// NOTE: set 'LOG_NODE_HEAPSTATS' env var to 'true' to log heap stats
// NOTE: set 'LOG_NODE_HEAPSTATS_INTERVAL_MS' env var to '<time_in_milliseconds>' for logging interval
// NOTE: To better understand heap stats being logged, check:
//   - https://nodejs.org/docs/v22.12.0/api/v8.html#v8getheapspacestatistics
//   - https://nodejs.org/docs/v22.12.0/api/v8.html#v8getheapstatistics
function trySetHeapLoggingAtInterval(config, logger) {
  logger.debug('heapLogger.js :: Entered "trySetHeapLoggingAtInterval"...')

  const shouldLogHeapstats = config.heapstats.logHeapstats
    ? config.heapstats.logHeapstats.toLowerCase() === 'true'
    : false

  logger.debug(`heapLogger.js :: "shouldLogHeapstats" set to "${shouldLogHeapstats}"`)

  if (shouldLogHeapstats) {
    const v8 = require('v8')

    const addCommas = num => Number(num).toLocaleString()
    const isNumeric = num => !isNaN(Number(num))

    // Set the heapstats logging interval
    const maybeInterval = config.heapstats.logInverval
    const heapStatsInverval = maybeInterval && isNumeric(maybeInterval) ? maybeInterval : 30000

    logger.debug(`heapLogger.js :: heap stats logging interval will be "${heapStatsInverval}" ms`)

    // Function to log the heap space statistics
    const logHeapSpaceStats = () => {
      // Get the current timestamp
      const currentTimestamp = new Date().toISOString()

      // Get the heap space statistics
      const heapSpaceStats = v8.getHeapSpaceStatistics()

      heapSpaceStats.forEach(space => {
        const heapStatsMessage =
          `[${currentTimestamp}] Heap Space Statistics: ` +
          `Space Name: '${space.space_name}', ` +
          `Space Size: '${addCommas(space.space_size)}' bytes, ` +
          `Space Used Size: '${addCommas(space.space_used_size)}' bytes, ` +
          `Space Available Size: '${addCommas(space.space_available_size)}' bytes, ` +
          `Physical Space Size: '${addCommas(space.physical_space_size)}' bytes` +
          '\n--------------------------'

        logger.info(heapStatsMessage)
      })

      // Get the heap statistics
      const heapStats = v8.getHeapStatistics()

      const heapStatsMessage =
        `[${currentTimestamp}] Heap Statistics: ` +
        `Total Heap Size: '${addCommas(heapStats.total_heap_size)}' bytes, ` +
        `Total Heap Size Executable: '${addCommas(heapStats.total_heap_size_executable)}' bytes, ` +
        `Total Physical Size: '${addCommas(heapStats.total_physical_size)}' bytes, ` +
        `Total Available Size: '${addCommas(heapStats.total_available_size)}' bytes, ` +
        `Used Heap Size: '${addCommas(heapStats.used_heap_size)}' bytes, ` +
        `Heap Size Limit: '${addCommas(heapStats.heap_size_limit)}' bytes` +
        '\n--------------------------'

      logger.info(heapStatsMessage)
    }

    // Only run if not in a test environment
    if (process.argv.every(arg => !arg.includes('mocha'))) {
      logger.debug(`heapLogger.js :: setting heap stats logging at "${heapStatsInverval}" ms interval...`)

      // Set the interval to log the heap space statistics
      setInterval(logHeapSpaceStats, heapStatsInverval)

      logger.debug(`heapLogger.js :: set heap stats logging at "${heapStatsInverval}" ms interval.`)
    }
  } else {
    logger.debug('heapLogger.js :: heap stats logging not enabled.')
  }

  logger.debug('heapLogger.js :: Exiting "trySetHeapLoggingAtInterval".')
}

module.exports = trySetHeapLoggingAtInterval
