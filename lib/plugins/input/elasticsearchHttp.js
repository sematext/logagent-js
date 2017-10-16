var consoleLogger = require('../../util/logger.js')
var http = require('http')
var throng = require('throng')
var safeStringify = require('fast-safe-stringify')
const errResponse = '{"error":{"root_cause":[{"type":"action_request_validation_exception","reason":"Validation Failed: 1: no requests added;"}],"type":"action_request_validation_exception","reason":"Validation Failed: 1: no requests added;"},"status":400}'

function InputElasticsearchHttp (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (config.workers) {
    this.config.workers = config.workers
  } else {
    this.config.workers = 1
  }
}
InputElasticsearchHttp.prototype.start = function () {
  consoleLogger.log('Loading Elasticsearch HTTP input')
  if (this.config) {
    throng({
      workers: this.config.workers || this.WORKERS || 1,
      lifetime: Infinity
    }, this.startElasticsearchHttp.bind(this))
  }
}
InputElasticsearchHttp.prototype.stop = function (cb) {
  cb()
}

function createIndexCall (action, source) {
  source._index = action._index
  source._type = action._type
  if (action._id) {
    source._id = action._id
  }
  return source
}

function isJson (str) {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

InputElasticsearchHttp.prototype.getHttpServer = function (aport, handler) {
  var _port = aport || process.env.PORT || 9200
  if (aport === true) {
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

InputElasticsearchHttp.prototype.elasticSearchHttpHandler = function (req, res) {
  try {
    var self = this
    var path = req.url.split('/')
    var token = null
    if (path.length > 1) {
      if (path[1] && path[1].length === 5 && path[1] === '_bulk') {
        token = path[1]
      }
    }

    if (!token) {
      res.end(errResponse)
      return
    }

    // check content type
    var contype = req.headers['content-type']
    if (!contype || contype !== 'application/x-ndjson') {
      res.end(errResponse)
      return
    }

    var bodyIn = ''
    req.on('data', function (data) {
      bodyIn += data
    })

    req.on('end', function endHandler () {
      var document = bodyIn.split('\n')
      var offSet = 0
      var okResponse = {
        took: 7,
        errors: false,
        items: []
      }
      document.forEach(function (line) {
        if (isJson(document[offSet])) {
          var lineObj = JSON.parse(document[offSet])
          // create a factory to manage other action
          if (lineObj.index) {
            var source = JSON.parse(document[offSet + 1])
            offSet += 2 // each index request has 2 lines, one command + one document
            var emitMsg = safeStringify(createIndexCall(lineObj.index, source))
            var responseItem = {
              index: {
                result: 'created',
                forced_refresh: false
              }
            }
            responseItem._index = source._index
            responseItem._type = source._type
            responseItem._id = source._id
            okResponse.items.push(responseItem)
            self.eventEmitter.emit('data.raw', emitMsg, { source: 'input-elasticsearch-http', index: lineObj.index._index })
          } else {
            consoleLogger.log('Command not supported yet: ' + document[offSet])
            offSet += 1
          }
        }
      })
      res.end(safeStringify(okResponse))
    })
  } catch (err) {
    res.statusCode = 500
    res.end()
    consoleLogger.error('Error in Elasticsearch HTTP: ' + err)
  }
}

InputElasticsearchHttp.prototype.startElasticsearchHttp = function (id) {
  this.getHttpServer(Number(this.config.port), this.elasticSearchHttpHandler.bind(this))
  var exitInProgress = false
  var terminate = function (reason) {
    return function () {
      if (exitInProgress) {
        return
      }
      exitInProgress = true
      consoleLogger.log('Stop Elasticsearch http worker: ' + id + ', pid:' + process.pid + ', terminate reason: ' + reason + ' memory rss: ' + (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB')
      setTimeout(process.exit, 250)
    }
  }
  process.once('SIGTERM', terminate('SIGTERM'))
  process.once('SIGINT', terminate('SIGINT'))
  process.once('exit', terminate('exit'))
}

module.exports = InputElasticsearchHttp
