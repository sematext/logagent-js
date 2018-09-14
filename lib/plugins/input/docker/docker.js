'use strict'
var loghose = require('docker-loghose')
var through = require('through2')
var dockerInspectHelper = require('./dockerInspect.js')
var consoleLogger = require('../../../util/logger.js')
var dockerInspectCache = {}
var ansiEscapeRegEx = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
var dotRegex = /\./g
var ignoreLogsPattern = null
var removeAnsiEscapeSeq = true

function InputDockerSocket (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (config.REMOVE_ANSI_ESCAPE_SEQ) {
    process.env.REMOVE_ANSI_ESCAPE_SEQ = config.REMOVE_ANSI_ESCAPE_SEQ
  }
  if (process.env.REMOVE_ANSI_ESCAPE_SEQ === 'disabled') {
    removeAnsiEscapeSeq = false
  }
  if (process.env.IGNORE_LOGS_PATTERN) {
    ignoreLogsPattern = new RegExp(process.env.IGNORE_LOGS_PATTERN)
  }
  if (config.socket && config.socket.indexOf('/') === 0) {
    config.socket = 'unix://' + config.socket
  }
  if (!config.socket) {
    config.socket = 'unix://var/run/docker.sock'
  }
  if (config.socket && !process.env.DOCKER_HOST) {
    process.env.DOCKER_HOST = config.socket
  }
  if (!config.labelFilter && !process.env.TAGGING_LABELS) {
    // collect docker
    config.labelFilter = 'com.docker.*,io.kubernetes.*,annotation.io.*'
  }
  if (config.labelFilter && !process.env.TAGGING_LABELS) {
    process.env.TAGGING_LABELS = config.labelFilter
  }
  this.opts = {
    json: false,
    newline: true,
    docker: null,
    events: null,
    includeCurrentContainer: false,
    // the following options limit the containers being matched
    // so we can avoid catching logs for unwanted containers
    matchByName: process.env.MATCH_BY_NAME || config.MATCH_BY_NAME,
    matchByImage: process.env.MATCH_BY_IMAGE || config.MATCH_BY_IMAGE,
    skipByName: process.env.SKIP_BY_NAME || config.SKIP_BY_NAME,
    skipByImage: process.env.SKIP_BY_IMAGE || config.SKIP_BY_IMAGE,
    attachFilter: function (id, info) {
      var dockerInfo = dockerInspectHelper.getLogseneEnabled(info)
      if (dockerInfo) {
        var cid = id.substr(0, 12)
        dockerInspectCache[cid] = dockerInfo
        dockerInfo.taggingLabels = getTaggingLabels(dockerInfo)
      }
      return (dockerInfo.LOGSENE_ENABLED === true)
    }
  }
}

function getTaggingLabels (dockerInspect) {
  if (dockerInspect && dockerInspect.tags) {
    // Elasticsearch 5 does not support dots in field names (for String fields)
    // Dots would be interpreted as object properties, which could cause errors during indexing
    var tags = {}
    var keys = Object.keys(dockerInspect.tags)
    if (keys.length === 0) {
      return null
    }
    for (var i = 0; i < keys.length; i++) {
      // replace dots with underscore and create new tag list
      var elasticsearchCompliantFieldName = keys[i].replace(dotRegex, '_')
      tags[elasticsearchCompliantFieldName] = dockerInspect.tags[keys[i]]
    }
    return tags
  } else {
    return null
  }
}

InputDockerSocket.prototype.start = function () {
  if (!process.env.REMOVE_ANSI_ESCAPE_SEQ) {
    process.env.REMOVE_ANSI_ESCAPE_SEQ = 'enabled'
  }
  this.connect()
}

InputDockerSocket.prototype.stop = function (cb) {
  cb()
}

InputDockerSocket.prototype.logLine = function (messageText, data, next) {
  var logContext = {
    sourceName: data.image + '_' + data.name + '_' + data.id,
    image: data.image,
    container_id: data.id,
    container_name: data.name,
    time: data.time
  }
  var dockerInspect = dockerInspectCache[data.id]
  if (dockerInspect) {
    logContext.dockerInspect = dockerInspect
    if (dockerInspect.taggingLabels) {
      logContext.labels = dockerInspect.taggingLabels
    }
  }
  var line = removeAnsiEscapeSeq ? messageText.replace(ansiEscapeRegEx, '') : messageText
  this.eventEmitter.emit('data.raw', line, logContext)
}

InputDockerSocket.prototype.connect = function () {
  var self = this
  var options = self.opts
  self.logStream = through.obj(function (chunk, enc, cb) {
    if (!chunk.line) {
      cb()
      return
    }
    setImmediate(function () {
      // self.debugLog('Logs from Docker API:', chunk)
      if (ignoreLogsPattern && ignoreLogsPattern.test(chunk.line)) {
        return cb()
      }
      self.logLine(chunk.line, chunk)
      cb()
    })
  })
  this.lh = loghose(options)
  try {
    this.lh.on('error', this.reconnect.bind(this))
    this.lh.pipe(self.logStream).on('error', this.reconnect.bind(this))
  } catch (ex) {
    console.error('reconnect to docker socket in 1 sec ...')
    setTimeout(this.reconnect, 1000)
  }
}

InputDockerSocket.prototype.reconnect = function (err) {
  var self = this
  consoleLogger.log('error', 'Error in log stream: ' + err)
  try {
    consoleLogger.log('debug', 'reconnect to docker.sock ')
    self.logStream = null
    self.connect.bind(self)()
  } catch (ex) {
    consoleLogger.log('error', ex)
    consoleLogger.log('debug', 'reconnect to docker.sock failed')
  }
}

module.exports = InputDockerSocket
