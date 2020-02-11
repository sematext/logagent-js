var consoleLogger = require('../../util/logger.js')
var http = require('http')
var safeStringify = require('fast-safe-stringify')
var throng = require('throng')

function GitHub (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (config.worker) {
    this.config.worker = config.workers
  } else {
    this.config.workers = 0
  }
}

GitHub.prototype.start = function () {
  if (this.config.workers && this.config.workers > 0) {
    throng({
      workers: this.config.workers,
      lifetime: Infinity
    }, this.startGitHub.bind(this))
  } else {
    this.startGitHub(1)
  }
}

GitHub.prototype.stop = function (cb) {
  cb()
}

GitHub.prototype.emitEvent = function (log, token) {
  // var config = this.config
  var context = { name: 'GitHub', sourceName: 'GitHub' }
  if (token) {
    context.index = token
  }
  this.eventEmitter.emit('data.raw', safeStringify(log), context)
}

GitHub.prototype.getHttpServer = function (aport, handler) {
  var _port = aport || process.env.PORT || 7700
  if (aport === true) {
    _port = process.env.PORT
  }
  var server = http.createServer(handler)
  try {
    var bindAddress = this.config.bindAddress || '0.0.0.0'
    server = server.listen(_port, bindAddress)
    consoleLogger.log('Logagent listening (HTTP GitHub): ' + bindAddress + ':' + _port + ', process id: ' + process.pid)
    return server
  } catch (err) {
    consoleLogger.log('Port in use HTTP GitHub (' + _port + '): ' + err)
  }
}

GitHub.prototype.parseReq = function (req, token) {
  const self = this
  const headers = JSON.parse(req.headers)
  const body = JSON.parse(req.body)
  const log = { ...headers, ...body, '@timestamp': new Date() }
  consoleLogger.log('log: ', log)

  /**
   * Needed format
   */

  /*
  {
    "timestamp" : "2014-02-17T15:29:04+0100",
    "message" : "MyApp on MyHost04 restarted",
    "severity": "warn",
    "type" : "server-info"
  }'

  OR

  {
    "timestamp" : "2018-02-17T15:58:04+0100",
    "message" : "Solr 7.0.0 version deployed on prodhost06",
    "name" : "Solr 7.0.0 deployment",
    "tags" : ["solr", "7.0.0", "deployment", "upgrade"],
    "severity": "info",
    "priority" : "High",
    "creator" : "John Smith",
    "type" : "deployment"
  }'
 */

  self.emitEvent(log, token)
  return log
}

GitHub.prototype.HttpHandler = function (req, res) {
  try {
    var self = this
    var bodyIn = ''
    var token = null

    req.on('data', function (data) {
      bodyIn += String(data)
      // console.log(data)
    })

    req.on('end', function endHandler () {
      const log = self.parseReq({ headers: req.headers, body: bodyIn }, token)
      // send response to client
      res.writeHead(
        200,
        { 'Content-Type': 'text/plain' }
      )
      // res.end('OK\n')
      res.end(safeStringify(log))
    })
  } catch (err) {
    res.statusCode = 500
    res.end()
    consoleLogger.error('Error in GitHub HttpHandler: ' + err)
  }
}

GitHub.prototype.startGitHub = function (id) {
  this.getHttpServer(Number(this.config.port), this.HttpHandler.bind(this))
  var exitInProgress = false
  var terminate = function (reason) {
    return function () {
      if (exitInProgress) {
        return
      }
      exitInProgress = true
      consoleLogger.log('Stop GitHub HTTP worker: ' + id + ', pid:' + process.pid + ', terminate reason: ' + reason + ' memory rss: ' + (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB')
      setTimeout(process.exit, 250)
    }
  }
  process.once('SIGTERM', terminate('SIGTERM'))
  process.once('SIGINT', terminate('SIGINT'))
  process.once('exit', terminate('exit'))
}

module.exports = GitHub
