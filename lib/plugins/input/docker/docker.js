'use strict'
const loghose = require('docker-loghose')
const through = require('through2')
const dockerInspectHelper = require('./dockerInspect.js')
const consoleLogger = require('../../../util/logger.js')
const ansiEscapeRegEx = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
const dotRegex = /\./g
const TRUE_REGEX = /true/i
// The run.sh sets both LOGSENE_ENABLED_DEFAULT and LOGS_ENABLED_DEFAULT to TRUE by default.
// Users should set either of these two to FALSE to disable logging by default for all containers.
// This means you need to use whitelisting to enable logging for certain containers.
// In the ENV for those containers set 'LOGS_ENABLED=true' or 'LOGSENE_ENABLED=true'.
// const LOGS_ENABLED_DEFAULT = TRUE_REGEX.test((process.env.LOGSENE_ENABLED_DEFAULT && process.env.LOGS_ENABLED_DEFAULT) || 'true')
const LOGSENE_ENABLED_DEFAULT = TRUE_REGEX.test(
  process.env.LOGSENE_ENABLED_DEFAULT
)
const LOGS_ENABLED_DEFAULT = TRUE_REGEX.test(process.env.LOGS_ENABLED_DEFAULT)
const FINAL_LOGS_ENABLED_DEFAULT =
  LOGSENE_ENABLED_DEFAULT && LOGS_ENABLED_DEFAULT

var ignoreLogsPattern = null
var removeAnsiEscapeSeq = true
var dockerInspectCache = {}

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
    skipByImage:
      process.env.SKIP_BY_IMAGE || config.SKIP_BY_IMAGE || 'sematext/.*agent.*',
    attachFilter: function (id, info) {
      var dockerInfo = dockerInspectHelper.getLogseneEnabled(info)
      if (dockerInfo) {
        var cid = id.substr(0, 12)
        dockerInspectCache[cid] = dockerInfo
        dockerInfo.taggingLabels = getTaggingLabels(dockerInfo)
      }
      // filter via k8s annotations
      // in k8s we have to collect all logs and detach log streams
      // later once POD events are handled.
      if (
        FINAL_LOGS_ENABLED_DEFAULT === false &&
        process.env.KUBERNETES_SERVICE_HOST !== undefined
      ) {
        // LA running in k8s environment
        return true
      } else {
        return dockerInfo.LOGSENE_ENABLED === true
      }
    }
  }
  // close log stream if any output filter like kubernetes-enrichment
  // emits the 'dropLogsRequest' event or collectLogsEvent
  var self = this
  eventEmitter.on('dropLogsRequest', function (context, data) {
    if (self.lh) {
      if (self.config.debug) {
        consoleLogger.log(
          `Docker dropLogsRequest: disable log stream for ${context.container_name} ${context.container_id}`
        )
      }
      // self.lh.detachContainer(context.container_id)
      self.lh.detachContainer(context.container_long_id)
    }
  })
  eventEmitter.on('collectLogsRequest', function (context, data) {
    // todo make PR for docker-loghose to expose function attachContainer
    if (self.lh && self.lh.attachContainer) {
      if (self.config.debug) {
        consoleLogger.log(
          `collectLogsRequest: enable log stream for ${context.container_name} ${context.container_id}`
        )
      }
      // self.lh.attachContainer(context.container_id)
      self.lh.attachContainer(context.container_long_id)
    }
  })
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
    container_long_id: data.long_id,
    container_name: data.name,
    time: data.time,
    enrichEvent: {
      // make sure each docker log gets timestamp from docker engine
      '@timestamp_docker_engine': new Date(data.time)
    }
  }
  var dockerInspect = dockerInspectCache[data.id]
  if (dockerInspect) {
    logContext.dockerInspect = dockerInspect
    if (dockerInspect.taggingLabels) {
      logContext.labels = dockerInspect.taggingLabels
    }
  }
  var line = removeAnsiEscapeSeq
    ? messageText.replace(ansiEscapeRegEx, '')
    : messageText
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
  try {
    this.lh = loghose(options)
    this.lh.on('error', this.reconnect.bind(this))
    self.logStream.on('error', this.reconnect.bind(this))
    this.lh.pipe(self.logStream).on('error', this.reconnect.bind(this))
  } catch (ex) {
    consoleLogger.error('reconnect to docker socket in 10 sec ...')
    setTimeout(this.reconnect.bind(this), 10000)
  }
}

InputDockerSocket.prototype.reconnect = function (err) {
  var self = this
  consoleLogger.log('error', 'Error in log stream: ' + err)
  try {
    consoleLogger.log('info', 'reconnect to docker.sock ')
    self.logStream = null
    self.connect.bind(self)()
  } catch (ex) {
    consoleLogger.log('error', 'reconnect to docker.sock failed')
    // consoleLogger.log('error', ex)
  }
}

module.exports = InputDockerSocket
