var consoleLogger = require('../../util/logger.js')
var http = require('http')

function InputHeroku (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}
InputHeroku.prototype.start = function () {
  if (this.config.heroku) {
    this.throng = require('throng')
    this.throng({
      workers: this.WORKERS,
      lifetime: Infinity
    }, this.startHerokuServer.bind(this))
  }
}

InputHeroku.prototype.stop = function (cb) {
  cb()
}

InputHeroku.prototype.getHttpServer = function (aport, handler) {
  var _port = aport || process.env.PORT
  if (aport === true) { // a commadn line flag was set but no port given
    _port = process.env.PORT
  }
  var server = http.createServer(handler)
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
    data['_type'] = context.sourceName.replace('_' + context.index, '')
    data['logSource'] = ('' + data['logSource']).replace('_' + context.index, '')
    var msg = {
      message: data.message,
      app: data.app,
      host: data.host,
      process_type: data.process_type,
      originalLine: data.originalLine,
      severity: data.severity,
      facility: data.facility
    }
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
      if (path[1] && path[1].length > 31 && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(path[1])) {
        token = path[1]
      } else {
        // console.log('Bad Url: ' + path)
        // console.log(JSON.stringify(req.headers))
      }
    }
    if (!token) {
      res.end('<html><head><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css"</head><body><div class="alert alert-danger" role="alert">Error: Missing Logsene Token ' +
        req.url + '. Please use /LOGSENE_TOKEN. More info: <ul><li><a href="https://github.com/sematext/logagent-js#logagent-as-heroku-log-drain">Heroku Log Drain for Logsene</a> </li><li><a href="https://www.sematext.com/logsene/">Logsene Log Management by Sematext</a></li></ul></div></body><html>')
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
        self.eventEmitter.emit('data.raw', line, {sourceName: 'heroku_' + token, index: token, filter: filterHerokuMessage})
      })
      res.end('ok\n')
    })
  } catch (err) {
    consoleLogger.error('Error in Heroku (http): ' + err)
  }
}

// heroku start function for WEB_CONCURENCY
InputHeroku.prototype.startHerokuServer = function () {
  this.getHttpServer(Number(this.config.heroku), this.herokuHandler.bind(this))
  process.once('SIGTERM', function () {
    consoleLogger.log('Worker exit()')
  })
}

module.exports = InputHeroku
