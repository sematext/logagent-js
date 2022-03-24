'use strict'
const consoleLogger = require('../../util/logger.js')
const Logsene = require('logsene-js')
const LogSourceToIndexMapper = require('../../core/logSourceToIndexMapper.js')
const fs = require('graceful-fs')
const reduceConfig = require('../../util/config-reducer.js')
const tokenFormatRegEx = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
function formatObject (o) {
  var rv = ''
  Object.keys(o).forEach(function (key) {
    if (o[key].url) {
      o[key].url = o[key].url.replace(tokenFormatRegEx, 'ANONYMIZED_LOGS_TOKEN')
    }
    rv = rv + ' ' + key + '=' + JSON.stringify(o[key])
  })
  return rv
}

function OutputElasticsearch (config, eventEmitter) {
  this.config = config
  this.logCount = 0
  this.eventEmitter = eventEmitter
  this.consoleLogger = consoleLogger
  this.loggers = {}
  this.laStats = require('../../core/printStats')
  if (config.indices) {
    config.tokenMapper = new LogSourceToIndexMapper(config.indices)
  }
  if (this.config.url) {
    this.config.elasticsearchUrl = config.url
  }
  if (this.config.httpOptions) {
    if (this.config.httpOptions.key) {
      try {
        this.config.httpOptions.key = fs.readFileSync(
          this.config.httpOptions.key
        )
      } catch (ex) {
        consoleLogger.error(
          'Error reading SSL key file ' + this.config.httpOptions.key + ' ' + ex
        )
      }
    }
    if (this.config.httpOptions.cert) {
      try {
        this.config.httpOptions.cert = fs.readFileSync(
          this.config.httpOptions.cert
        )
      } catch (ex) {
        consoleLogger.error(
          'Error reading SSL cert file ' +
            this.config.httpOptions.cert +
            ' ' +
            ex
        )
      }
    }
    if (this.config.httpOptions.ca) {
      try {
        this.config.httpOptions.ca = fs.readFileSync(this.config.httpOptions.ca)
      } catch (ex) {
        consoleLogger.error(
          'Error reading SSL CA file ' + this.config.httpOptions.ca + ' ' + ex
        )
      }
    }
    this.httpOptions = this.config.httpOptions
  }
}

OutputElasticsearch.prototype.indexData = function (
  token,
  logType,
  data,
  config,
  logsReceiverUrl
) {
  var logger = this.getLogger(token, logType, config, logsReceiverUrl)
  this.logCount++
  logger.log(
    data.severity || data.level || 'info',
    data.message || data.msg || data.MESSAGE,
    data
  )

  if (config.debug) {
    consoleLogger.log(
      'DEBUG-ES-OUTPUT\n' +
        `Shipped Log: { severity: ${data.severity ||
          data.level ||
          'info'}, message: ${data.message || data.msg || data.MESSAGE} }\n` +
        `Endpoint: ${logsReceiverUrl}/${token}`
    )
  }
}

OutputElasticsearch.prototype.getLogger = function (
  token,
  type,
  config,
  logsReceiverUrl
) {
  var url = logsReceiverUrl || config.elasticsearchUrl
  var loggerName = `${url}/${token}`
  if (!this.loggers[loggerName]) {
    var options = {
      useIndexInBulkUrl: true,
      silent: true,
      httpOptions: { keepAlive: true }
    }

    var usedType = type
    if (/logsene/.test(config.elasticsearchUrl)) {
      // in case the index does not exist, using /_bulk would create it
      options.useIndexInBulkUrl = false
    } else {
      usedType = config.type || 'logs'
    }
    if (this.httpOptions && url !== logsReceiverUrl) {
      options.httpOptions = this.httpOptions
    }
    var logger = new Logsene(
      token,
      usedType,
      url,
      config.diskBufferDir,
      options
    )
    this.laStats.usedTokens.push(token)
    logger.on(
      'log',
      function (data) {
        this.laStats.logsShipped += Number(data.count) || 0
        this.logCount = this.logCount - data.count
      }.bind(this)
    )
    logger.on(
      'x-logsene-error',
      function (err) {
        this.laStats.httpFailed++
        const errorMessage =
          'Error in Elasticsearch request: ' +
          formatObject(err) +
          ' / ' +
          formatObject(err.err)

        logger.emit('error', errorMessage)
      }.bind(this)
    )
    logger.on(
      'error',
      function (errorMessage) {
        this.eventEmitter.emit('error', errorMessage)
      }.bind(this)
    )
    logger.on(
      'rt',
      function (data) {
        consoleLogger.warn('Retransmit ' + data.file + ' to ' + data.url)
        this.laStats.retransmit += 1
        this.laStats.logsShipped += data.count
      }.bind(this)
    )
    if (process.env.LOG_NEW_TOKENS) {
      consoleLogger.log(`New elasticsearch logger ${loggerName} created`)
    }
    this.loggers[loggerName] = logger
  }
  return this.loggers[loggerName]
}

OutputElasticsearch.prototype.eventHandler = function (data, context) {
  if (
    context.logsDestination &&
    this.config.configName &&
    this.config.configName.indexOf(context.logsDestination) === -1
  ) {
    return
  }
  const config = reduceConfig(context, data, this.config)
  let index =
    data._index ||
    context.index ||
    config.index ||
    process.env.LOGSENE_TOKEN ||
    process.env.LOGS_TOKEN
  const logsReceiverUrl =
    context.logsReceiver ||
    config.url ||
    process.env.LOGS_RECEIVER_URL

  if (config.tokenMapper) {
    if (config.dropLogsForUnmatchedIndices === true) {
      index = config.tokenMapper.findToken(data.logSource || context.sourceName)
    } else {
      index =
        config.tokenMapper.findToken(data.logSource || context.sourceName) ||
        index
    }
  }

  if (index) {
    index = applyDateFormatToIndex(index, data)
    if (data._index !== undefined) {
      data._index = index
    }
    this.indexData(index, data._type || 'logs', data, config, logsReceiverUrl)
  }

  if (context.logsReceivers && context.logsReceivers.length > 0) {
    context.logsReceivers.forEach(receiver => {
      const receiverIndex = applyDateFormatToIndex(receiver.index, data)
      if (data._index !== undefined) {
        data._index = receiverIndex
      }
      this.indexData(
        receiverIndex,
        data._type || 'logs',
        data,
        config,
        receiver.url
      )
    })
  }
}

function applyDateFormatToIndex (index, data) {
  // support for time-based index patterns
  return index.replace(/YYYY|MM|DD/g, function (match) {
    if (match === 'YYYY') {
      return '' + data['@timestamp'].getFullYear()
    }
    if (match === 'MM') {
      return ('0' + (data['@timestamp'].getMonth() + 1)).substr(-2)
    }
    if (match === 'DD') {
      return ('0' + data['@timestamp'].getDate()).substr(-2)
    }
    return match
  })
}

OutputElasticsearch.prototype.start = function () {
  if (this.config.index || this.config.elasticsearchUrl) {
    this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
  }
}

OutputElasticsearch.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  var self = this
  process.nextTick(
    function () {
      var count = Object.keys(this.loggers).length - 1
      Object.keys(this.loggers).forEach(
        function (l) {
          consoleLogger.log('send ' + l)
          this.loggers[l].send()
          this.loggers[l].on('log', function (evt) {
            count = count - 1
            consoleLogger.log(
              'flushed ' +
                evt.count +
                ' logs for ' +
                self.config.elasticsearchUrl +
                ' ' +
                l +
                ', logs in buffer: ' +
                self.logCount
            )
            if (self.logCount === 0) {
              cb()
            }
          })
          this.loggers[l].once('error', function () {
            count = count - 1
            consoleLogger.error('flushed logs for ' + l + ' failed')
            if (count === 0) {
              cb()
            }
          })
        }.bind(this)
      )
    }.bind(this)
  )
}

module.exports = OutputElasticsearch
