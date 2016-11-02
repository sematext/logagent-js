/**
  * sourceName - origin of the log, e.g. file name
  * config - properties from the config section for this plugin
  * data - the log message as string
  * callback - callback function (err, data).
  */
module.exports = function (sourceName, config, data, callback) {
  try {
    var drop = false
    if (config.matchSource) {
      if (!config.matchSource.test(sourceName)) {
        // pass data for unmatched source names
        return callback(null, data)
      }
    }
    // filter data for matched source names
    if (config.include) {
      drop = !config.include.test(data)
    }
    if (config.exclude) {
      drop = config.exclude.test(data) || drop
    }
    drop ? callback(null, null) : callback(null, data)
  } catch (err) {
    return callback(null, data)
  }
}
