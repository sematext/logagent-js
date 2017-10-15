var consoleLogger = require('../../util/logger.js')
var http = require('http')
var throng = require('throng')
var safeStringify = require('fast-safe-stringify')
const err_response = '{"error":{"root_cause":[{"type":"action_request_validation_exception","reason":"Validation Failed: 1: no requests added;"}],"type":"action_request_validation_exception","reason":"Validation Failed: 1: no requests added;"},"status":400}'
//In a second moment I'll create a dynamic response
const ok_response = '{"took":7, "errors": false, "items":[{"index":{"_index":"test","_type":"type1","_id":"1","_version":1,"result":"created","forced_refresh":false}}]}'


function InputElasticsearchHttp (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (config.configFile.input.workers) {
    this.config.workers = config.configFile.input.workers
  } else {
    this.config.workers = undefined
  }
}
InputElasticsearchHttp.prototype.start = function () {
  consoleLogger.log('loading Elasticsearch HTTP')
  if (this.config) {
    throng({
      workers: this.config.workers || this.WORKERS || 2,
      lifetime: Infinity
    }, this.startElasticsearchHttp.bind(this))
  }
}
InputElasticsearchHttp.prototype.stop = function (cb) {
  cb()
}

function cretaIndexCall(action,source) {
    //I'm sure that there is a smart method but I don't find it ! 
     var emitObject = new Object()
     emitObject._index= action._index;
     emitObject._type= action._type;
     emitObject._id= action._id;
     secondPart = JSON.stringify(emitObject)
     firtPart = source.replace(' }',', ');
     emitMsg = firtPart + secondPart.substr(1,secondPart.length);
     return emitMsg 
  }
  
  function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
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
      if (path[1] && path[1].length == 5 && "_bulk"===path[1]) {
        token = path[1]
      }
    }

    if (!token) {
      res.end(err_response)
      return
    }

    //check content type
   var contype = req.headers['content-type'];
    if(!contype || "application/x-ndjson" !== contype )
    {
      res.end(err_response)
      return 
    }
    
    var bodyIn = ''
    req.on('data', function (data) {
      bodyIn += data
    })
    
    req.on('end', function endHandler () {
      var document = bodyIn.split('\n')
      offSet = 0;
      document.forEach(function(line)
      {
        if(isJson(document[offSet]))
        {
          lineObj = JSON.parse(document[offSet])
          //create a factory to manage other action
          if(lineObj.index)
          {
            source = document[offSet +1]   
            offSet +=2
            emitMsg = cretaIndexCall(lineObj.index,source)
            self.eventEmitter.emit('data.raw', emitMsg, {source: 'input-elasticsearch-http', index: lineObj.index._index })
          }
          else 
          {
            console.log('command not supported yet' +  document[offSet])
            offSet +=1
          }
        }
          
    })
      res.end(ok_response)
    })
  } catch (err) {
    consoleLogger.error('Error in Elasticsearch http: ' + err)
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
      consoleLogger.log('stop Elasticsearch http worker: ' + id + ', pid:' + process.pid + ', terminate reason: ' + reason + ' memory rss: ' + (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB')
      setTimeout(process.exit, 250)
    }
  }
  process.once('SIGTERM', terminate('SIGTERM'))
  process.once('SIGINT', terminate('SIGINT'))
  process.once('exit', terminate('exit'))
}

module.exports = InputElasticsearchHttp
