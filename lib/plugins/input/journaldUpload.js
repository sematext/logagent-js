var consoleLogger = require('../../util/logger.js')
var http = require('http')
var safeStringify = require('fast-safe-stringify')
var throng = require('throng')

function JournaldUpload (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (config.workers) {
    this.config.workers = config.workers
  } else {
    this.config.workers = 0
  }
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

JournaldUpload.prototype.parseBody = function (body) {
  var self = this
  var lines = body.split('\n')
  var log = {}
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('__CURSOR') > -1) {
      log = {}
    }
    var index = lines[i].indexOf('=')
    if (index > -1 && lines[i].length > 0) {
      var fieldName = lines[i].substr(0, index)
      var fieldValue = lines[i].substr(index + 1, lines[i].length)
      if (fieldName === 'MESSAGE') {
        log['message'] = fieldValue
      } else {
        log[fieldName] = fieldValue
      }
      if (fieldName === '__REALTIME_TIMESTAMP') {
        log['@timestamp'] = new Date(Number(log['__REALTIME_TIMESTAMP']) / 1000)
      }
    } else {
      if (lines[i] === '' && log !== null) {
        var context = { name: 'journald', sourceName: log['_SYSTEMD_UNIT'] || 'journald' }
        self.eventEmitter.emit('data.raw', safeStringify(log), context)
        log = null
      }
    }
  }
  if (log !== null && log['@timestamp']) {
    var context2 = { name: 'journald', sourceName: log['_SYSTEMD_UNIT'] || 'journald' }
    self.eventEmitter.emit('data.raw', safeStringify(log), context2)
  }
}

JournaldUpload.prototype.journaldHttpHandler = function (req, res) {
  try {
    var self = this
    var bodyIn = ''
    req.on('data', function (data) {
      bodyIn += String(data)
      // onsole.log(data)
    })

    req.on('end', function endHandler () {
      self.parseBody(bodyIn)
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
  var exitInProgress = false
  var terminate = function (reason) {
    return function () {
      if (exitInProgress) {
        return
      }
      exitInProgress = true
      consoleLogger.log('Stop JournaldUpload http worker: ' + id + ', pid:' + process.pid + ', terminate reason: ' + reason + ' memory rss: ' + (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB')
      setTimeout(process.exit, 250)
    }
  }
  process.once('SIGTERM', terminate('SIGTERM'))
  process.once('SIGINT', terminate('SIGINT'))
  process.once('exit', terminate('exit'))
}

module.exports = JournaldUpload
