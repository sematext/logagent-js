const consoleLogger = require('../../util/logger.js')
const http = require('http')
const extractTokenRegEx = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/
const tokenFormatRegEx = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
const TokenBlacklist = require('../../util/token-blacklist.js')

function jsonParse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

function extractJson (line, source) {
  var parsed = {}
  if (/^\[{0,1}\{.*\}]{0,1}$/.test(line)) {
    parsed = jsonParse(line)
    if (!parsed) {
      return null
    }
    return parsed
  }
}

function InputHeroku (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.tokenBlackList = new TokenBlacklist(eventEmitter)
  this.config.port = this.config.heroku || config.port
  if (config.workers) {
    this.config.herokuWorkers = config.workers
  } else {
    this.config.herokuWorkers = undefined
  }
}
InputHeroku.prototype.start = function () {
  if (this.config.port) {
    this.throng = require('throng')
    this.throng({
      workers: this.config.herokuWorkers || this.WORKERS || 2,
      lifetime: Infinity
    }, this.startHerokuServer.bind(this))
  }
}

InputHeroku.prototype.stop = function (cb) {
  if (this.server) {
    this.server.close(cb)
  }
}

InputHeroku.prototype.getHttpServer = function (aport, handler) {
  var _port = aport || process.env.PORT
  if (aport === true) { // a command line flag was set but no port given
    _port = process.env.PORT
  }
  var server = http.createServer(handler)
  this.server = server
  try {
    server = server.listen(_port)
    consoleLogger.log('Logagent listening (http): ' + _port + ', process id: ' + process.pid)
    return server
  } catch (err) {
    consoleLogger.log('Port in use (' + _port + '): ' + err)
  }
}

function filterHerokuMessage (data, context) {
  if (data) {
    data._type = context.sourceName.replace('_' + context.index, '')
    data.logSource = ('' + data.logSource).replace('_' + context.index, '')
    var msg = {
      message: data.message,
      app: data.app,
      host: data.host,
      process_type: data.process_type,
      originalLine: data.originalLine,
      severity: data.severity,
      facility: data.facility
    }
    msg.json = extractJson(msg.message)
    var optionalFields = ['method', 'path', 'host', 'request_id', 'fwd', 'dyno', 'connect', 'service', 'status', 'bytes']
    optionalFields.forEach(function (f) {
      if (data[f]) {
        msg[f] = data[f]
      }
    })
    if (!data['@timestamp']) {
      msg['@timestamp'] = new Date()
    }
    return msg
  }
}

InputHeroku.prototype.herokuHandler = function (req, res) {
  try {
    var self = this
    var path = req.url.split('/')
    var token = null
    if (path.length > 1) {
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
    
    if (!token) {
      res.end('<html><head><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css"</head><body><div class="alert alert-danger" role="alert">Error: Missing Logsene Token ' +
        req.url + '. Please use /LOGSENE_TOKEN. More info: <ul><li><a href="https://github.com/sematext/logagent-js#logagent-as-heroku-log-drain">Heroku Log Drain for Logsene</a> </li><li><a href="https://www.sematext.com/logsene/">Logsene Log Management by Sematext</a></li></ul></div></body><html>')
      return
    }

    if ((self.config.useIndexFromUrlPath === true && !token) || self.tokenBlackList.isTokenInvalid(token)) {
      res.statusCode = 404
      res.end(`invalid logs token in url ${req.url}\n`)
      return
    }

    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function endHandler () {
      var lines = body.split('\n')
      lines.forEach(function (line) {
        if (!line) {
          return
        }
        self.eventEmitter.emit('data.raw', line, { sourceName: 'heroku_' + token, index: token, filter: filterHerokuMessage })
      })
      res.end('ok\n')
    })
  } catch (err) {
    consoleLogger.error('Error in Heroku (http): ' + err)
  }
}
// heroku start function for WEB_CONCURENCY
InputHeroku.prototype.startHerokuServer = function (id) {
  consoleLogger.log('start heroku worker: ' + id + ', pid:' + process.pid)
  this.getHttpServer(Number(this.config.port), this.herokuHandler.bind(this))
  var exitInProgress = false
  var terminate = function (reason) {
    return function () {
      if (exitInProgress) {
        return
      }
      exitInProgress = true
      consoleLogger.log('stop heroku worker: ' + id + ', pid:' + process.pid + ', terminate reason: ' + reason + ' memory rss: ' + (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB')
      setTimeout(process.exit, 250)
    }
  }
  process.once('SIGTERM', terminate('SIGTERM'))
  process.once('SIGINT', terminate('SIGINT'))
  process.once('exit', terminate('exit'))
}

module.exports = InputHeroku
