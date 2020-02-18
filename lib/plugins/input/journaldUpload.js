const consoleLogger = require('../../util/logger.js')
const http = require('http')
const throng = require('throng')
const extractTokenRegEx = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/
const tokenFormatRegEx = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/

// journald fields for lowercase access
const __CURSOR = '__CURSOR'
const __REALTIME_TIMESTAMP = '__realtime_timestamp'
const __SOURCE_REALTIME_TIMESTAMP = '_source_realtime_timestamp'
const SYSLOG_IDENTIFIER = 'syslog_identifier'
const _HOSTNAME = '_hostname'
const _SYSTEMD_UNIT = '_systemd_unit'
const PRIORITY = 'priority'
const SYSLOG_FACILITY = 'syslog_facility'
// field mapping for Sematext Common Schema
const processFields = {
  '_pid': 'pid',
  '_uid': 'uid',
  '_gid': 'gid',
  '_cmdline': 'cmd',
  '_systemd_cgroup': 'cgroup'
}
// mapping for syslog priority and facility values 
const SEVERITY = [
  'emerg',
  'alert',
  'crit',
  'err',
  'warning',
  'notice',
  'info',
  'debug'
]
const FACILITY = [
  'kern',
  'user',
  'mail',
  'daemon',
  'auth',
  'syslog',
  'lpr',
  'news',
  'uucp',
  'cron',
  'authpriv',
  'ftp',
  'ntp',
  'logaudit',
  'logalert',
  'clock',
  'local0',
  'local1',
  'local2',
  'local3',
  'local4',
  'local5',
  'local6',
  'local7'
]
const TokenBlacklist = require('../../util/tokenBlackList.js')
function JournaldUpload (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.removeFields = {}
  this.tokenBlackList = new TokenBlacklist(eventEmitter)

  if (config.useSematextCommonSchema === undefined) {
    config.useSematextCommonSchema = true
  }
  if (config.removeFields) {
    for (var i = 0; i < config.removeFields.length; i++) {
      this.removeFields[config.removeFields[i].toLowerCase()] = true
    }
  }
  // set default filter
  if (!config.systemdUnitFilter) {
    config.systemdUnitFilter = {
      include: /.*/i,
      exlude: null
    }
  }

  if (config.workers) {
    this.config.workers = config.workers
  } else {
    this.config.workers = 0
  }
  // blacklist invalid tokens
  let self = this
  
}

JournaldUpload.prototype.start = function () {
  if (this.config.workers && this.config.workers > 0) {
    throng({
      workers: this.config.workers,
      lifetime: Infinity
    }, this.startJournaldUpload.bind(this))
  } else {
    this.startJournaldUpload(1)
  }
}

JournaldUpload.prototype.stop = function (cb) {
  cb()
}

// Transforming fields to Sematext Common Schema https://sematext.com/docs/tags/common-schema/
// see https://sematext.com/docs/agents/sematext-agent/processes/metadata/
JournaldUpload.prototype.applySematextCommonSchema = function (log) {
  // use Sematext common schema os.host = hostname
  let hostname = log[_HOSTNAME]
  if (hostname) {
    log.os = {host: hostname}
    delete log[_HOSTNAME]
  }
  let timestamp = log[__REALTIME_TIMESTAMP] || log[__SOURCE_REALTIME_TIMESTAMP]
  if (timestamp) {
    var d = new Date(Number(fieldValue) / 1000)
    if (d instanceof Date && !isNaN(d)) {
      log['@timestamp'] = d
    }
  }
  let prio = log[PRIORITY]
  let facility = log[log[SYSLOG_FACILITY]]
  // handling syslog priorit and facility values 
  if (prio || facility) {
    log.facility = FACILITY[facility] || String(facility)
    log.severity = SEVERITY[prio] || String(prio)
    delete log[PRIORITY]
    delete log[log[SYSLOG_FACILITY]]
  }
  if (log['_pid']) {
    log.process = {}
  } else {
    return
  }
  for (field in processFields) {
    if (log[field]) {
      log.process[processFields[field]] = log[field]
      delete log[field]
    }
  }
}

JournaldUpload.prototype.emitEvent = function (log, token) {
  let systemdUnit = log[_SYSTEMD_UNIT]
  let config = this.config
  if (systemdUnit) {
    if (config.systemdUnitFilter !== undefined && config.systemdUnitFilter.include && !config.systemdUnitFilter.include.test(log['_SYSTEMD_UNIT'])) {
      return
    }
    if (config.systemdUnitFilter !== undefined && config.systemdUnitFilter.exclude && config.systemdUnitFilter.exclude.test(log['_SYSTEMD_UNIT'])) {
      return
    }
  }
  this.addTags(log)
  let context = {
    sourceName: log[_SYSTEMD_UNIT] || log[SYSLOG_IDENTIFIER] || 'journald',
    name: 'journald'
  }

  if (token) {
    // set index, for elasticsearch output plugin
    context.index = token
  }
  if (this.config.useSematextCommonSchema) {
    this.applySematextCommonSchema(log)
  }
  this.eventEmitter.emit('data.object', log, context)
}

JournaldUpload.prototype.addTags = function (log) {
  if (this.config.tags === undefined) {
    return
  }
  let keys = Object.keys(this.config.tags)
  for (let i = 0; i < keys.length; i++) {
    // avoid setting _index when passed in URL
    if (log[keys[i]] === undefined) {
      log[keys[i]] = this.config.tags[keys[i]]
    }
  }
}

JournaldUpload.prototype.getHttpServer = function (aport, handler) {
  var _port = aport || process.env.PORT || 9200
  if (aport === true) {
    _port = process.env.PORT
  }
  var server = http.createServer(handler)
  try {
    var bindAddress = this.config.bindAddress || '0.0.0.0'
    server = server.listen(_port, bindAddress)
    consoleLogger.log('Logagent listening (http journald-upload): ' + bindAddress + ':' + _port + ', process id: ' + process.pid)
    return server
  } catch (err) {
    consoleLogger.log('Port in use journald-upload (' + _port + '): ' + err)
  }
}

JournaldUpload.prototype.parseBody = function (body, token) {
  let self = this
  let lines = body.split('\n')
  let log = null
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(__CURSOR) > -1) {
      log = {}
    }
    var index = lines[i].indexOf('=')
    if (index > -1 && lines[i].length > 0) {
      var fieldName = lines[i].substr(0, index)
      var fieldValue = lines[i].substr(index + 1, lines[i].length)
      if (!self.removeFields[fieldName]) {
        log[fieldName.toLowerCase()] = fieldValue
      }
    } else {
      if (lines[i] === '' && log !== null) {
        self.emitEvent(log, token)
        log = null
      }
    }
  }
  if (log !== null && log['@timestamp'] !== undefined) {
    self.emitEvent(log, token)
  }
}

JournaldUpload.prototype.journaldHttpHandler = function (req, res) {
  try {
    this.config.useIndexFromUrlPath = true
    let self = this
    let bodyIn = ''
    let path = req.url.split('/')
    let token = null
    if (self.config.useIndexFromUrlPath === true && path.length > 1) {
      if (path[1] && path[1].length > 31 && tokenFormatRegEx.test(path[1])) {
        let match = path[1].match(extractTokenRegEx)
        if (match && match.length > 1) {
          token = match[1]
        }
      } else if (path[1] === 'health' || path[1] === 'ping') {
        res.statusCode = 200
        res.end('ok\n')
        return
      }
    }

    if ((self.config.useIndexFromUrlPath === true && !token) || self.tokenBlackList.isTokenInvalid(token)) {
      res.statusCode = 401
      res.end(`invalid logs token in url ${req.url}`)
      return
    }

    req.on('data', function (data) {
      bodyIn += String(data)
    })

    req.on('end', function endHandler () {
      self.parseBody(bodyIn, token)
      // send response to client
      res.writeHead(
        200,
        { 'Content-Type': 'text/plain' }
      )
      res.end('OK\n')
    })
  } catch (err) {
    res.statusCode = 500
    res.end()
    consoleLogger.error('Error in journaldHttpHandler: ' + err)
  }
}

JournaldUpload.prototype.startJournaldUpload = function (id) {
  this.getHttpServer(Number(this.config.port), this.journaldHttpHandler.bind(this))
  let exitInProgress = false
  let terminate = function (reason) {
    return function () {
      if (exitInProgress) {
        return
      }
      exitInProgress = true
      consoleLogger.log('Stop journald-upload http worker: ' + id + ', pid:' + process.pid + ', terminate reason: ' + reason + ' memory rss: ' + (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB')
      setTimeout(process.exit, 250)
    }
  }
  process.once('SIGTERM', terminate('SIGTERM'))
  process.once('SIGINT', terminate('SIGINT'))
  process.once('exit', terminate('exit'))
}

module.exports = JournaldUpload
