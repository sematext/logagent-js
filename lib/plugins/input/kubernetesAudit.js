var consoleLogger = require('../../util/logger.js')
var http = require('http')
var throng = require('throng')

function KubernetesAudit (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (config.worker) {
    this.config.worker = config.workers
  } else {
    this.config.workers = 0
  }
}

KubernetesAudit.prototype.start = function () {
  if (this.config.workers && this.config.workers > 0) {
    throng({
      workers: this.config.workers,
      lifetime: Infinity
    }, this.startKubernetesAudit.bind(this))
  } else {
    this.startKubernetesAudit(1)
  }
}

KubernetesAudit.prototype.stop = function (cb) {
  cb()
}

KubernetesAudit.prototype.emitEvent = function (log, token) {
  var config = this.config
  this.addTags(log)
  var context = { name: 'k8sAudit', sourceName: 'k8sAudit' }
  if (token) {
    context.index = token
  }
  this.eventEmitter.emit('data.object', log, context)
}

KubernetesAudit.prototype.addTags = function (log) {
  if (this.config.tags === undefined) {
    return
  }
  var keys = Object.keys(this.config.tags)
  for (var i = 0; i < keys.length; i++) {
    // avoid setting _index when passed in URL
    if (log[keys[i]] === undefined) {
      log[keys[i]] = this.config.tags[keys[i]]
    }
  }
}

KubernetesAudit.prototype.getHttpServer = function (aport, handler) {
  var _port = aport || process.env.PORT || 9200
  if (aport === true) {
    _port = process.env.PORT
  }
  var server = http.createServer(handler)
  try {
    var bindAddress = this.config.bindAddress || '0.0.0.0'
    server = server.listen(_port, bindAddress)
    consoleLogger.log('Logagent listening (http k8s audit): ' + bindAddress + ':' + _port + ', process id: ' + process.pid)
    return server
  } catch (err) {
    consoleLogger.log('Port in use k8s audit (' + _port + '): ' + err)
  }
}

KubernetesAudit.prototype.parseBody = function (body, token) {
  var self = this
  var docs = JSON.parse(body)
  if (docs.items && docs.items.length > 0) {
    for (var i = 0; i < docs.items.length; i++) {
      var log = docs.items[i]
      log['@timestamp'] = new Date(log.timestamp)
      self.emitEvent(log, token)
    }
  }
}

KubernetesAudit.prototype.HttpHandler = function (req, res) {
  try {
    var self = this
    var bodyIn = ''
    var path = req.url.split('/')
    var token = null
    if (self.config.useIndexFromUrlPath === true && path.length > 1) {
      if (path[1] && path[1].length > 31 && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(path[1])) {
        token = path[1]
      } else if (path[1] === 'health' || path[1] === 'ping') {
        res.statusCode = 200
        res.end('ok\n')
        return
      }
    }
    req.on('data', function (data) {
      bodyIn += String(data)
      // onsole.log(data)
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
    consoleLogger.error('Error in Kubernetes Audit HttpHandler: ' + err)
  }
}

KubernetesAudit.prototype.startKubernetesAudit = function (id) {
  this.getHttpServer(Number(this.config.port), this.HttpHandler.bind(this))
  var exitInProgress = false
  var terminate = function (reason) {
    return function () {
      if (exitInProgress) {
        return
      }
      exitInProgress = true
      consoleLogger.log('Stop k8s audit http worker: ' + id + ', pid:' + process.pid + ', terminate reason: ' + reason + ' memory rss: ' + (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB')
      setTimeout(process.exit, 250)
    }
  }
  process.once('SIGTERM', terminate('SIGTERM'))
  process.once('SIGINT', terminate('SIGINT'))
  process.once('exit', terminate('exit'))
}

module.exports = KubernetesAudit


