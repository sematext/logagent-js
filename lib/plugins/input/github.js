var consoleLogger = require('../../util/logger.js')
var http = require('http')
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
  this.addTags(log)
  if (token) {
    log['_index'] = token
  }
  var context = { name: 'GitHub', sourceName: 'GitHub', type: 'GitHub Event' }
  if (token) {
    context.index = token
  }
  this.eventEmitter.emit('data.object', log, context)
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

GitHub.prototype.addTags = function (log) {
  if (this.config.tags === undefined) {
    return
  }
  log.tags = this.config.tags
}

GitHub.prototype.parseReq = function (req, token) {
  const self = this
  const headers = req.headers
  const event = headers['x-github-event']
  /**
   * x-github-event" headers that define what data to collect:
   *
   * issues
   * issue_comment
   * pull_request
   * pull_request_review
   * pull_request_review_comment
   * push
   * create
   * delete
   * release
   *
   * add switch based on @event String to generate log fields
   */

  const body = JSON.parse(req.body)
  const { action } = body

  const log = {
    severity: 'info',
    title: `GitHub ${event} ${action}`,
    message: `New event triggered on your repository. It was a ${event} ${action}.`,
    ...headers,
    ...body
  }

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

  OR

  {
    "timestamp": "2019-05-30T09:58:43.455Z",
    "creator": "Jenkins",
    "host": "jenkins-host",
    "title": "Starting deployment",
    "message": "Started deployment of Test v1.23 to production",
    "severity": "info",
    "type": "deployment",
    "tags": ["version:1.23", "env:prod"],
  }
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
      self.parseReq({ headers: req.headers, body: bodyIn }, token)
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
