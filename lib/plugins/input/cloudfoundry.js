var consoleLogger = require('../../util/logger.js')
var http = require('http')

function InputCloudFoundry (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (config.configFile.input.cloudFoundry && config.configFile.input.cloudFoundry.blacklist) {
    this.config.blacklist = config.configFile.input.cloudFoundry.blacklist
  } else {
    this.config.blacklist = {}
  }
  if (config.configFile.input.cloudFoundry.workers) {
    this.config.cloudFoundryWorkers = config.configFile.input.heroku.workers
  } else {
    this.config.cloudFoundryWorkers = undefined
  }
}
InputCloudFoundry.prototype.start = function () {
  if (this.config.cfhttp) {
    this.throng = require('throng')
    this.throng({
      workers: this.config.cloudFoundryWorkers || this.WORKERS || 2,
      lifetime: Infinity
    }, this.startCloudfoundryServer.bind(this))
  }
}

InputCloudFoundry.prototype.stop = function (cb) {
  cb()
}

InputCloudFoundry.prototype.getHttpServer = function (aport, handler) {
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

function filterCloudfoundryMessage (data, context) {
  if (data) {
    data['_type'] = context.sourceName.replace('_' + context.index, '')
    data['logSource'] = ('' + data['logSource']).replace('_' + context.index, '')
    if (!data['@timestamp']) {
      data['@timestamp'] = new Date()
    }
  }
  return data
}

InputCloudFoundry.prototype.cloudFoundryHandler = function (req, res) {
  try {
    var self = this
    var eventEmitter = this.eventEmitter
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
        req.url + '. Please use /LOGSENE_TOKEN. More info: <ul><li><a href="https://github.com/sematext/logagent-js">CloudFoundry Log Drain for Logsene</a> </li><li><a href="https://www.sematext.com/logsene/">Logsene Log Management by Sematext</a></li></ul></div></body><html>')
      return
    }
    if (self.config && self.config.blacklist && self.config.blacklist[token]) {
      if (self.config.configFile.input.heroku.debug) {
        consoleLogger.log('blacklisted request for' + token)
      }
      res.statusCode = 404
      return res.end()
    }
    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function () {
      var lines = body.split('\n')
      lines.forEach(function (line) {
        if (!line) {
          return
        }
        eventEmitter.emit('data.raw', line.trim(), {sourceName: 'cloudfoundry_' + token, index: token, filter: filterCloudfoundryMessage})
      })
      res.end('ok\n')
    })
  } catch (err) {
    consoleLogger.error('Error in Cloud Foundry (http): ' + err)
  }
}

// start function for WEB_CONCURENCY
InputCloudFoundry.prototype.startCloudfoundryServer = function (id) {
  consoleLogger.log('start cloudfoundry worker: ' + id + ', pid:' + process.pid)
  this.getHttpServer(Number(this.config.cfhttp), this.cloudFoundryHandler.bind(this))
  process.once('SIGTERM', function () {
    consoleLogger.log('stop cloudfoundry worker: ' + id + ', pid:' + process.pid)
    process.exit()
  })
}

module.exports = InputCloudFoundry
