var consoleLogger = require('../logger.js')
var http = require('http')

function getLoggerForToken (token, logtype) {
  return function (err, data) {
    if (!err && data) {
      delete data.ts
      // delete data.ts
      data['_type'] = ('' + logtype).replace('_' + token, '')
      data['logSource'] = ('' + data['logSource']).replace('_' + token, '')
      var msg = data
      this.log(err, msg)
      if (/heroku/.test(logtype)) {
        msg = {
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
      }
      this.logToLogsene(token, logtype, msg)
    }
  }
}

function herokuHandler (req, res) {
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
    req.on('end', function () {
      var lines = body.split('\n')
      lines.forEach(function (line) {
        if (!line) {
          return
        }
        try {
          self.parseLine(line, 'heroku_' + token, function (err, data) {
            if (data) {
              if (process.env.ENABLE_MESSAGE_PARSER !== 'true') {
                getLoggerForToken(token, 'heroku_' + token).call(self, err, data)
              } else {
                self.parseLine(data.message, (data.app || 'undefined') + '_' + token, function (e, d) {
                  if (d) {
                    data.message = d.message
                    data.parsed_message = d
                  }
                  getLoggerForToken(token, 'heroku_' + token).call(self,err, data)
                })
              }
            }
          })
        } catch (unknownError) {
          consoleLogger.log(unknownError + ' ' + unknownError.stack)
        }
      })
      res.end('ok\n')
    })
  } catch (err) {
    consoleLogger.error(new Date() + ': ' + err)
  }
}

// heroku start function for WEB_CONCURENCY
function startHerokuServer () {
  getHttpServer.bind(this)(Number(this.argv.heroku), herokuHandler.bind(this))
  process.once('SIGTERM', function () {
    this.terminate('exitWorker')
    consoleLogger.log('Worker exiting')
  }.bind(this))
}

// heroku start function for WEB_CONCURENCY
function startCloudfoundryServer () {
  getHttpServer.bind(this)(Number(this.argv.cfhttp), cloudFoundryHandler.bind(this))
}

function cloudFoundryHandler (req, res) {
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
      req.url + '. Please use /LOGSENE_TOKEN. More info: <ul><li><a href="https://github.com/sematext/logagent-js">CloudFoundry Log Drain for Logsene</a> </li><li><a href="https://www.sematext.com/logsene/">Logsene Log Management by Sematext</a></li></ul></div></body><html>')
    return
  }
  var body = ''
  req.on('data', function (data) {
    body += data
  })
  req.on('end', function () {
    try {
      self.parseLine(body, 'cloudfoundry_' + token, function (err, data) {

        if (data) {
          if (process.env.ENABLE_MESSAGE_PARSER !== 'true') {
            getLoggerForToken(token, 'cloudfoundry_' + token).call(self, err, data)
          } else {
            self.parseLine.call(self, data.message, (data.app || 'undefined') + '_' + token, function (e, d) {
              console.log(d)
              if (d) {
                data.message = d.message
                data.parsed_message = d
              }
              getLoggerForToken(token, 'cloudfoundry_' + token).call(self,err, data)
            })
          }
        }
      })
      res.end()
    } catch (unknownError) {
      consoleLogger.log(unknownError.stack)
      res.end()
    }
  })
}
function getHttpServer (aport, handler) {
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
  


module.exports = {
  startCloudfoundryServer: startCloudfoundryServer,
  startHerokuServer: startHerokuServer
}

/*
http://logsene-receiver.sematext.com/0a835c75-9847-4f74-aaa2-8944416c38e2/example/?origin=stefans-laptop
curl -XPOST https://localhost:8080/0a835c75-9847-4f74-aaa2-8944416c38e2 -d <11>1 2016-05-17T12:52:27.977141+00:00 loggregator a72a81e4-d2fe-4595-ba68-8f8baa1c9b62 [STG] - - 2016-05-17 12:52:27,976 [INFO] cloudfoundry - CloudFoundry Initialized.`


curl -XPOST https://localhost/0a835c75-9847-4f74-aaa2-8944416c38e2 -d'<11>1 2016-05-17T12:52:27.977141+00:00 loggregator a72a81e4-d2fe-4595-ba68-8f8baa1c9b62 [STG] - - 2016-05-17 12:52:27,976 [INFO] cloudfoundry - CloudFoundry Initialized.’
// Heroku test
curl -XPOST http://localhost:9090/0a835c75-9847-4f74-aaa2-8944416c38e2 -d '250<158>1 2015-10-13T17:34:49.632709+00:00 host heroku router - at=info method=GET path=/ host=agile-atoll-8450.herokuapp.com request_id=adfffaf4-454a-4ef8-b0d3-837284df3fca fwd=95.90.128.210 dyno=web.1 connect=1ms service=5ms status=200 bytes=6119'


// CF TEst
curl -XPOST http://localhost:8080/0a835c75-9847-4f74-aaa2-8944416c38e2 -d ' <11>1 2016-05-17T12:52:27.977141+00:00 loggregator a72a81e4-d2fe-4595-ba68-8f8baa1c9b62 [STG] - - 2016-05-17 12:52:27,976 [INFO] cloudfoundry - CloudFoundry Initialized.'
*/
