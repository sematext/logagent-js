const consoleLogger = require('../../util/logger.js')
const http = require('http')
const throng = require('throng')
const split = require('split2')
const createStreamThrottle = require('../../util/throttle')
const extractTokenRegEx = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/
const tokenFormatRegEx = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
const _SYSTEMD_UNIT = '_systemd_unit'
const SYSLOG_IDENTIFIER = 'syslog_identifier'
const TokenBlacklist = require('../../util/token-blacklist.js')
const keyValueFieldRegex = /^\S+=.+$/ // key=value
const cursorRegex = /^__CURSOR=/
// const exportRecordRegex = /^(\S+)=(.+)$|^(\S+)$\n$\n([\S|\s]+)\n$/gm
class Parser {
  constructor (emitEvent, token, removeFields) {
    this.token = token
    this.emitEvent = emitEvent
    this.removeFields = removeFields
    this.multiLineMode = false
    this.log = {}
    this.multiLineFieldValue = ''
    this.multiLineFieldName = null
  }

  isMultilineMode () {
    return this.multiLineMode
  }

  startMultilineField (data) {
    if (!data) {
      return
    }

    this.multiLineMode = true
    this.multiLineFieldName = data
    this.multiLineFieldValue = ''
  }

  appendToMultilineField (value) {
    this.multiLineFieldValue += value
  }

  addField (data) {
    const index = data.indexOf('=')
    const fieldName = data.substr(0, index).toLowerCase()
    let value = data.substr(index + 1, data.length)
    if (!isNaN(value)) {
      value = Number(value)
    }
    if (fieldName.length > 0 && !this.removeFields[fieldName]) {
      this.log[fieldName] = value
    }
  }

  endMultiLineField () {
    this.multiLineMode = false
    if (this.multiLineFieldName === null) {
      return
    }
    this.log[this.multiLineFieldName] = this.multiLineFieldValue
    this.multiLineFieldValue = ''
    this.multiLineFieldName = null
  }

  end () {
    var log = this.log
    this.multiLineMode = false
    this.log = {}
    this.multiLineFieldValue = ''
    this.multiLineFieldName = null
    return log
  }

  getLog () {
    return this.log
  }

  // lines from http stream are pushed here
  consume (data) {
    // make sure that multiLine status ends with a new __CURSOR line
    if (cursorRegex.test(data)) {
      this.endMultiLineField()
    }
    // regular field: a=b
    if (
      keyValueFieldRegex.test(data) &&
      data.length > 0 &&
      this.isMultilineMode() === false
    ) {
      this.addField(data)
      return
    } else if (data.length > 0 && !this.isMultilineMode()) {
      // mulit-line field start
      this.startMultilineField(data)
      return
    }
    // multiline data
    if (this.isMultilineMode() && data.length > 0) {
      this.appendToMultilineField(`${data}\n`)
      return
    }
    // end of multiline field
    if (
      this.isMultilineMode() &&
      data.length === 0 &&
      this.multiLineFieldValue.length > 3
    ) {
      this.endMultiLineField()
      return
    }
    // end of a journal-log-entry
    if (data.length === 0 && this.isMultilineMode() === false) {
      this.emitEvent(this.end(), this.token)
    }
  }
}

function JournaldUpload (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.removeFields = {}
  this.tokenBlackList = new TokenBlacklist(eventEmitter)
  // limit throughput per client
  this.throughputPerClient = this.config.maxInputRate || 10 * 1024 * 1024
  if (config.useSematextCommonSchema === undefined) {
    config.useSematextCommonSchema = true
  }
  if (config.parseMessageField === undefined) {
    // try to parse logs using patterns.yml
    config.parseMessageField = true
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
}

JournaldUpload.prototype.start = function () {
  if (this.config.workers && this.config.workers > 0) {
    throng(
      {
        workers: this.config.workers,
        lifetime: Infinity
      },
      this.startJournaldUpload.bind(this)
    )
  } else {
    this.startJournaldUpload(1)
  }
}

JournaldUpload.prototype.stop = function (cb) {
  if (cb) {
    cb()
  }
}

JournaldUpload.prototype.emitEvent = function (log, token) {
  const systemdUnit = log[_SYSTEMD_UNIT]
  const config = this.config
  if (systemdUnit) {
    if (
      config.systemdUnitFilter !== undefined &&
      config.systemdUnitFilter.include &&
      !config.systemdUnitFilter.include.test(systemdUnit)
    ) {
      return
    }
    if (
      config.systemdUnitFilter !== undefined &&
      config.systemdUnitFilter.exclude &&
      config.systemdUnitFilter.exclude.test(systemdUnit)
    ) {
      return
    }
  } else {
    // ignore messages not from systemd
  }
  const context = {
    sourceName: log[_SYSTEMD_UNIT] || log[SYSLOG_IDENTIFIER] || 'journald',
    name: 'journald',
    index: token
  }

  if (Object.keys(log).length > 0) {
    this.addTags(log)
    this.eventEmitter.emit('data.object', log, context)
  }
}

JournaldUpload.prototype.addTags = function (log) {
  if (this.config.tags === undefined) {
    return
  }
  const keys = Object.keys(this.config.tags)
  for (let i = 0; i < keys.length; i++) {
    // avoid overwriting _index when passed in URL
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

  // Increase the connection timeout to equal the Nginx Ingress timeout of 1min.
  server.on('connection', socket => socket.setTimeout(60 * 1000))

  try {
    var bindAddress = this.config.bindAddress || '0.0.0.0'
    server = server.listen(_port, bindAddress)
    consoleLogger.log(
      'Logagent listening (http journald-upload): ' +
        bindAddress +
        ':' +
        _port +
        ', process id: ' +
        process.pid
    )
    return server
  } catch (err) {
    consoleLogger.log('Port in use journald-upload (' + _port + '): ' + err)
  }
}

JournaldUpload.prototype.journaldHttpHandler = function (req, res) {
  try {
    this.config.useIndexFromUrlPath = true
    const self = this
    const path = req.url.split('/')
    let token = null

    if (this.config.useIndexFromUrlPath === true && path.length > 1) {
      if (path[1] && path[1].length > 31 && tokenFormatRegEx.test(path[1])) {
        const match = path[1].match(extractTokenRegEx)
        if (match && match.length > 1) {
          token = match[1]
        }
      } else if (path[1] === 'health' || path[1] === 'ping') {
        res.statusCode = 200
        res.end('ok\n')
        return
      }
    }

    if (
      (this.config.useIndexFromUrlPath === true && !token) ||
      this.tokenBlackList.isTokenInvalid(token)
    ) {
      res.statusCode = this.config.invalidTokenStatus || 403
      res.end(`invalid logs token in url ${req.url}\n`)
      return
    }

    const parserState = new Parser(this.emitEvent.bind(this), token, this.removeFields)
    req
      .pipe(createStreamThrottle(this.throughputPerClient))
      .pipe(split())
      .on('data', parserState.consume.bind(parserState))
      .on('end', function endHandler () {
        const log = parserState.end()

        self.emitEvent(log, token)
        // send response to client
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('OK\n')
      })
      .on('error', console.error)
  } catch (err) {
    res.statusCode = 500
    res.end()
    consoleLogger.error('Error in journaldHttpHandler: ' + err)
  }
}

JournaldUpload.prototype.startJournaldUpload = function (id) {
  this.getHttpServer(
    Number(this.config.port),
    this.journaldHttpHandler.bind(this)
  )
  let exitInProgress = false
  const terminate = function (reason) {
    return function () {
      if (exitInProgress) {
        return
      }
      exitInProgress = true
      consoleLogger.log(
        'Stop journald-upload http worker: ' +
          id +
          ', pid:' +
          process.pid +
          ', terminate reason: ' +
          reason +
          ' memory rss: ' +
          (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) +
          ' MB'
      )
      setTimeout(process.exit, 250)
    }
  }
  process.once('SIGTERM', terminate('SIGTERM'))
  process.once('SIGINT', terminate('SIGINT'))
  process.once('exit', terminate('exit'))
}

module.exports = JournaldUpload
