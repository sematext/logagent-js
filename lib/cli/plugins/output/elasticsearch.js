'use strict'
var eventEmitter = require('../../logEventEmitter.js')
var consoleLogger = require('../../../logger.js')
var Logsene = require('logsene-js')

function formatObject (o) {
  var rv = ''
  Object.keys(o).forEach(function (key) {
    rv = rv + ' ' + key + '=' + o[key]
  })
  return rv
}

function OutputElasticsearch (config) {
  this.config = config
  this.consoleLogger = consoleLogger
  this.loggers = {}
  this.laStats = require('../../printStats')
}

OutputElasticsearch.prototype.indexData = function (token, logType, data) {
  var logger = this.getLogger(token, logType)
  logger.log(data.level || data.severity || 'info', data.message || data.msg || data.MESSAGE, data)
}

OutputElasticsearch.prototype.getLogger = function (token, type) {
  var loggerName = token + '_' + type
  if (!this.loggers[loggerName]) {
    var logger = new Logsene(token, type, this.config.elasticsearchUrl,
      this.config.diskBufferDir)
    this.laStats.usedTokens.push(token)
    logger.on('log', function (data) {
      this.laStats.logsShipped += (Number(data.count) || 0)
    }.bind(this))
    logger.on('error', function (err) {
      this.laStats.httpFailed++
      consoleLogger.error('Error in Logsene request: ' + formatObject(err) + ' / ' + formatObject(err.err))
    }.bind(this))
    logger.on('rt', function (data) {
      consoleLogger.warn('Retransmit ' + data.file + ' to ' + data.url)
      this.laStats.retransmit += 1
      this.laStats.logsShipped += data.count
    }.bind(this))
    if (process.env.LOG_NEW_TOKENS) {
      consoleLogger.log('create logger for token: ' + token)
    }
    this.loggers[loggerName] = logger
  }
  return this.loggers[loggerName]
}

OutputElasticsearch.prototype.eventHandler = function (data, context) {
  var index = context.index || this.config.index || process.env.LOGSENE_TOKEN
  if (this.config.tokenMapper) {
    var indexForSource = this.config.tokenMapper.findToken([data.logSource]) || index
    if (indexForSource) {
      this.indexData(indexForSource, data['_type'] || 'logs', data)
    }
  } else {
    if (index) {
      this.indexData(this.config.index, data['_type'] || 'logs', data)
    }
  }
}

OutputElasticsearch.prototype.start = function () {
  if (this.config.index) {
    eventEmitter.on('data.parsed', this.eventHandler.bind(this))
  }
}

OutputElasticsearch.prototype.stop = function (cb) {
  eventEmitter.removeListener('data.parsed', this.eventHandler)
  process.nextTick(function () {
    var count = Object.keys(this.loggers).length
    Object.keys(this.loggers).forEach(function (l, i) {
      consoleLogger.log('send ' + l)
      this.loggers[l].send()
      this.loggers[l].once('log', function () {
        count = count - 1
        consoleLogger.log('flushed logs for ' + l)
        if (count === 0) {
          cb()
        }
      }.bind({loggerName: l}))
      this.loggers[l].once('error', function () {
        count = count - 1
        consoleLogger.error('flushed logs for ' + l + ' failed')
        if (count === 0) {
          cb()
        }
      })
    }.bind(this))
  }.bind(this))
}

module.exports = {
  plugin: OutputElasticsearch,
  options: [{
    cfgName: 'output.elasticsearch.url',
    commanderName: 'elasticsearchUrl',
    commanderOptions: ['-e, --elasticsearchUrl <url>', 'elasticsearch url']
  }, {
    cfgName: 'output.elasticsearch.index',
    commanderName: 'index',
    commanderOptions: ['-i, --index <indexName>', 'elasticsearch index']
  }
  ]
}
