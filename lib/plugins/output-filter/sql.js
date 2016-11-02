'use strict'
var alasql = require('alasql')

function init (config, laContext, eventEmitter) {
  // create timer if it does not exist
  if (config.timerFunc !== undefined) {
    return
  }
  // helper funtion to run the query once per interval
  var queryTask = function () {
    runQueries(laContext.sourceName, config, eventEmitter)
  }
  config.timerFunc = setInterval(queryTask, (config.interval * 1000) || 1000)
}

function executeQuery (query, data, eventEmitter) {
  try {
    return query(data)
  } catch (err) {
    eventEmitter.emit('error', new Error('Error in outputFilter / SQL query: ' + err), err)
    return null
  }
}

function runQueries (sourceName, cfg, eventEmitter) {
  var tmpData = cfg.buffer[sourceName]
  if (tmpData) {
    var context = tmpData.context
    for (var q in tmpData.queries) {
      var result = executeQuery(tmpData.queries[q], [tmpData.data], eventEmitter)
      if (result && result.length > 0) {
        // emit events to output modules, listening for "data.parsed" events
        for (var i = 0; i < result.length; i++) {
          eventEmitter.emit('data.parsed', result[i], context)
        }
      } else {
        if (result) {
          eventEmitter.emit('data.parsed', result, context)
        }
      }
    }
    tmpData.data = null
    cfg.buffer[sourceName] = null
  }
}
// buffer logs per source to run SQL queries on it
function bufferEvents (context, config, eventEmitter, data) {
  if (!config.buffer) {
    config.buffer = {}
    if (config.debug) {
      eventEmitter.on('error', console.error)
    }
  }
  if (!config.buffer[context.sourceName]) {
    config.buffer[context.sourceName] = {
      data: [],
      context: context,
      queries: []
    }
    for (var c in config.queries) {
      var queryStr = config.queries[c]
      try {
        var query = alasql.compile(queryStr)
        config.buffer[context.sourceName].queries.push(query)
      } catch (err) {
        eventEmitter.emit('error', new Error('Error in sql output filter: ' + err.message))
      }
    }
  }
  config.buffer[context.sourceName].data.push(data)
}

function sqlFilter (context, config, eventEmitter, data, callback) {
  if (data == null) {
    return callback(new Error('data is null'), null)
  }
  if (config.matchSource.test(context.sourceName)) {
    init(config, context, eventEmitter)
    bufferEvents(context, config, eventEmitter, data)
    // drop single events, we will generate one event per interval
    callback()
  } else {
    // pass data of other log sources, to be handled by other filters
    callback(null, data)
  }
}
module.exports = sqlFilter
