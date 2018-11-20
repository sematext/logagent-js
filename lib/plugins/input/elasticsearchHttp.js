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
    this.config.workers = 0
  }
}
InputElasticsearchHttp.prototype.start = function () {
  if (this.config.workers && this.config.workers > 0) {
    throng({
      workers: this.config.workers,
      lifetime: Infinity
    }, this.startElasticsearchHttp.bind(this))
  } else {
    this.startElasticsearchHttp(1)
  }
}

InputElasticsearchHttp.prototype.stop = function (cb) {
  cb()
}

function createIndexCall (action, source, defaultIndex, defaultType) {
  source._index = action._index || defaultIndex
  source._type = action._type || defaultType
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
    var bindAddress = this.config.bindAddress || '0.0.0.0'
    server = server.listen(_port, bindAddress)
    consoleLogger.log('Logagent listening (http): ' + bindAddress + ':' + _port + ', process id: ' + process.pid)
    return server
  } catch (err) {
    consoleLogger.log('Port in use (' + _port + '): ' + err)
  }
}

InputElasticsearchHttp.prototype.validateRequest = function (req, res) {
  var path = req.url.split('/')
  var result = {
    defaultIndex: null,
    defaultType: null,
    isBulk: false,
    isValid: true
  }
  if (/\/_nodes|\/_search|\/_cat|\/_count|\/_settings|\/_mapping|\/_aliases|\/_reindex|\/_cluster/.test(req.url)) {
    result.isValid = false
    return result
  }
  if (path.length === 2) {
    // post to /_bulk?
    if (path[1] === '_bulk') {
      result.isBulk = true
    }
  }
  if (path.length === 3) {
    // post to /indexName/_bulk? or POST to /index/type?
    if (path[2] === '_bulk') {
      result.isBulk = true
    } else {
      result.defaultType = path[2]
    }
    if (path[1]) {
      result.defaultIndex = path[1]
    }
  }
  if (path.length === 4) {
    // post to /indexName/type/_bulk?
    if (path[3] === '_bulk') {
      result.isBulk = true
    }
    if (path[1]) {
      result.defaultIndex = path[1]
    }
    if (path[2]) {
      result.defaultType = path[2]
    }
  }
  return result
}
InputElasticsearchHttp.prototype.elasticSearchHttpHandler = function (req, res) {
  try {
    var self = this
    var reqInfo = self.validateRequest(req, res)
    if (!reqInfo.isValid) {
      return res.end(errResponse)
    }
    var bodyIn = ''
    req.on('data', function (data) {
      bodyIn += data
    })

    req.on('end', function endHandler () {
      if (!reqInfo.isBulk) {
        if (!bodyIn) {
          return res.end()
        }
        // post to single
        var msg = {}
        try {
          msg = JSON.parse(bodyIn)
        } catch (err) {
          consoleLogger.error('Invalid JSON: ' + bodyIn)
          return
        }
        msg._index = reqInfo.defaultIndex
        msg._type = reqInfo.defaultType
        return self.eventEmitter.emit('data.raw', safeStringify(msg), {
          source: 'input-elasticsearch-http',
          index: msg._index
        })
      }
      // process bulk data
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
            var emitMsg = safeStringify(createIndexCall(lineObj.index, source, reqInfo.defaultIndex, reqInfo.defaultType))
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
