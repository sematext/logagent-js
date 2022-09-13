function testCondition (data, fieldName, condition) {
  const value = data[fieldName]

  const isObj = isLiteralObject(value)
  if (isObj) {
    return condition.test(JSON.stringify(value))
  }
  return condition.test(String(value))
}

function isLiteralObject (a) {
  return !!a && a.constructor === Object
}

function logStatus (data, debug, a, b, c, d) {
  if (debug === true) {
    console.log(
      `drop-events plugin: ${a} ${b} ${c} ${d}`.replace(/undefined/g, '-')
    )
  }
}

function dropEventsFilter (context, config, eventEmitter, data, callback) {
  if (data === undefined) {
    return callback(new Error('data is null'), null)
  }
  var debug = config.debug
  try {
    if (!config.keys) {
      config.keys = Object.keys(config.filters)
    }
    var drop = false
    for (var i = 0; i < config.keys.length; i++) {
      var include = config.filters[config.keys[i]].include
      var exclude = config.filters[config.keys[i]].exclude
      if (config.filters[config.keys[i]].include) {
        drop = !testCondition(data, config.keys[i], include) || drop
        logStatus(
          data,
          debug,
          config.keys[i],
          'include',
          drop,
          config.filters[config.keys[i]].include
        )
      }
      if (config.filters[config.keys[i]].exclude) {
        drop = testCondition(data, config.keys[i], exclude) || drop
        logStatus(
          data,
          debug,
          config.keys[i],
          'exclude',
          drop,
          config.filters[config.keys[i]].exclude
        )
      }
    }
    logStatus(debug, 'filter result', drop)
    if (drop) {
      if (debug === true) {
        logStatus(data, debug, 'drop', JSON.stringify(data))
      }
      return callback(new Error('drop filter'))
    } else {
      if (debug === true) {
        logStatus(data, debug, 'pass', JSON.stringify(data))
      }
      return callback(null, data)
    }
  } catch (ex) {
    logStatus(data, debug, 'exceptoion', ex)
    // pass events in case of error
    return callback(null, data)
  }
}
module.exports = dropEventsFilter
