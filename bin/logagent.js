#!/bin/sh
':' // ; export MAX_MEM="--max-old-space-size=500"; exec "$(command -v node || command -v nodejs)" --harmony "${NODE_OPTIONS:-$MAX_MEM}" "$0" "$@" 
'use strict'
/*
 * @copyright Copyright (c) Sematext Group, Inc. - All Rights Reserved
 *
 * @licence logagent-js is free-to-use, proprietary software.
 * THIS IS PROPRIETARY SOURCE CODE OF Sematext Group, Inc. (Sematext)
 * This source code may not be copied, reverse engineered, or altered for any purpose.
 * This source code is to be used exclusively by users and customers of Sematext.
 * Please see the full license (found in LICENSE in this distribution) for details on its license and the licenses of its dependencies.
 */
var consoleLogger = require('../lib/logger.js')
var fs = require('fs')
var argv = require('../lib/cli/cliArgs.js')
var https = require('https')
var http = require('http')
var TailFileManager = require ('../lib/fileManager')
var prettyjson = require('prettyjson')
var LogAnalyzer = require('../lib/index.js')
var readline = require('readline')
var Logsene = require('logsene-js')
var http = require('http')
var dgram = require('dgram')
var mkpath = require('mkpath')
var flat = require('flat')

var begin = new Date().getTime()
var count = 0
var logsShipped = 0
var httpFailed = 0
var emptyLines = 0
var bytes = 0
var retransmit=0

var globPattern = argv.glob || process.env.GLOB_PATTERN
var logseneToken = argv.index || process.env.LOGSENE_TOKEN

var loggers = {}
var WORKERS = process.env.WEB_CONCURRENCY || 1

var udpClient = dgram.createSocket('udp4')


var removeAnsiColor = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
var logseneDiskBufferDir = argv['logseneTmpDir'] || process.env.LOGSENE_TMP_DIR || require('os').tmpdir()   
mkpath(logseneDiskBufferDir, function (err) {
  if (err) {
    console.error('ERROR: create directory LOGSENE_TMP_DIR (' + logseneDiskBufferDir + '): ' + err.message)
  }
})

var fileManager = null
// create fileManager only for tail files mode
if (argv.glob || argv.args.length>0) {
  fileManager = new TailFileManager({parseLine: parseLine, log: log})  
}

var la = new LogAnalyzer(argv.patternFiles, {}, function () {
  cli()
}.bind(this))

process.on('beforeExit', terminate)




function getLogger (token, type) {
  var loggerName = token + '_' + type
  if (!loggers[loggerName]) {
    var logger = new Logsene(token, type, null,
      logseneDiskBufferDir)
    logger.on('log', function (data) {
      logsShipped += (Number(data.count) || 0)
    })
    logger.on('error', function (err) {
      httpFailed++
      if (argv.verbose) {
        consoleLogger.error('Error in Logsene request: ' + formatObject(err))  
      }
    })
    logger.on('rt', function (data) {
      consoleLogger.warn('Retransmit ' + data.file + ' to ' + data.url)
      retransmit++
      logsShipped += data.count
    })
    if (process.env.LOG_NEW_TOKENS) {
      consoleLogger.log('create logger for token: ' + token)
    }
    loggers[loggerName] = logger
  }
  return loggers[loggerName]
}

function _logToLogsene () {
  var logger = getLogger(String(this.token), this.type)
  var data = this.data
  logger.log(data.level || data.severity || 'info', data.message || data.msg || data.MESSAGE, data) 
}
function logToLogsene (logToken, logType, data) {
  setImmediate(_logToLogsene.bind({
    token: logToken, 
    data: data, 
    logType: logType}))
}

function getLoggerForToken (token, logtype) {
  return function (err, data) {
    if (!err && data) {
      delete data.ts
      // delete data.ts
      data['_type'] = ('' + type).replace('_' +token, '')
      data['logSource'] = ('' + data['logSource']).replace('_' +token, '')
      var msg = data
      log(err, msg)
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
      logToLogsene(token, logtype, msg)
    }
  }
}

function herokuHandler (req, res) {
  try {
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
          parseLine(line, 'heroku_'+token, function (err, data) {
            if (data) {
              if (process.env.ENABLE_MESSAGE_PARSER !== 'true') {
                getLoggerForToken(token, 'heroku_'+token)(err, data)
              } else {
                parseLine(data.message, (data.app || 'undefined')+ '_' + token, function (e, d) {
                  if (d) {
                    data.message=d.message
                    data.parsed_message = d
                  }
                  getLoggerForToken(token, 'heroku_'+token)(err, data)
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
  getHttpServer(Number(argv.heroku), herokuHandler)
  process.once('SIGTERM', function () {
    terminate('exitWorker')
    consoleLogger.log('Worker exiting')
  })
}

// heroku start function for WEB_CONCURENCY
function startCloudfoundryServer () {
  getHttpServer(Number(argv.cfhttp), cloudFoundryHandler)
  process.once('SIGTERM', function () {
    terminate('exitWorker')
    consoleLogger.log('Worker exiting')
  })
}

function cloudFoundryHandler (req, res) {
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
      parseLine(body, 'cloudfoundry_'+token, function (err, data) {
        if (data) {
          if (process.env.ENABLE_MESSAGE_PARSER !== 'true') {
            getLoggerForToken(token, 'cloudfoundry_'+token)(err, data)
          } else {
            parseLine(data.message, (data.app || 'undefined') + '_' + token, function (e, d) {
              if (d) {
                data.message=d.message
                data.parsed_message = d
              }
              getLoggerForToken(token, 'cloudfoundry_'+token)(err, data)
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

function log (err, data) {
  if (err && !data) {
    emptyLines++
    return
  }

  if (argv.indices) {
    var tokenForSource = argv.indices[data.logSource] || argv.index
    if (tokenForSource) {
      logToLogsene(tokenForSource, data['_type'] || 'logs', data)  
    }
  } else {
    if (argv.index) {
      logToLogsene(argv.index, data['_type'] || 'logs', data)
    }  
  }
  
  if (argv['rtailPort']) {
    var ts = data['@timestamp']
    delete data['@timestamp']
    delete data['originalLine']
    delete data['ts']
    var type = data['logSource']
    delete data['_type']
    var message = new Buffer(JSON.stringify({
      timestamp: ts || new Date(),
      content: data.message,
      id: type || argv.sourceName || 'logs'
    }))
    udpClient.send(message, 0, message.length, argv['rtailPort'], argv['rtailHost'] || 'localhost', function (err) {
      // udpClient.close()
    })
  }
  if (argv.suppress) {
    return
  }
  if (argv.pretty) {
    console.log(JSON.stringify(data, null, '\t'))
  } else if (argv.yaml) {
    console.log(prettyjson.render(data, {noColor: false}) + '\n')
  } else {
    console.log(JSON.stringify(data))
  }
}

function prettyJs (o) {
  var rv = ''
  var f = flat(o)
  Object.keys(f).forEach(function (key, i) {
    rv += key + ': ' + f[key] + ' '
  })
  return rv
}

function parseLine (line, sourceName, cbf) {
  if (!line && cbf) {
    return cbf(new Error('empty line passed to parseLine()'))
  }
  bytes += line.length
  count++
  la.parseLine(line.replace(removeAnsiColor, ''),
    argv.sourceName || sourceName, cbf || log)
}



function readStdIn () {
  var tr = require('through2')
  var split = require('split')
  process.stdin.on('end', terminate)
  process.stdin.pipe(split()).pipe(tr(function (chunk, enc, callback) {
    parseLine(chunk.toString())
    setImmediate(callback)
  }))
  
}


function formatObject(o) {
  var rv = ''
  Object.keys(o).forEach(function (key) {
    rv = rv + ' ' + key + '=' + o[key]
  })
  return rv
}

function printStats () {
  var now = new Date().getTime()
  var duration = now - begin
  var throughput = count / (duration / 1000)
  var throughputBytes = (bytes / 1024 / 1024) / (duration / 1000)
  var logStatsMsg = formatObject({
    usedTokens: Object.keys(loggers).length,
    shippedLogs: logsShipped,
    httpFailed: httpFailed,
    httpRetransmit: retransmit,
    throughputLinesPerSecond: throughput.toFixed(0)
  })
  var memStats = formatObject({
    heapUsedMB: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(0),
    heapTotalMB: (process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(0),
    memoryRssMB: (process.memoryUsage().rss / (1024 * 1024)).toFixed(0)
  })
  consoleLogger.log('Logagent report: pid['+process.pid + ']' + ' ' + duration + ' ms ' + count + ' lines parsed.  ' + throughput.toFixed(0) + ' lines/s ' + throughputBytes.toFixed(3) + ' MB/s - empty lines: ' + emptyLines)
  consoleLogger.log('Logagent stats:' + logStatsMsg)
  consoleLogger.log('Memory stats: ' + memStats)
  begin = now
  begin = now
  count = 0
  bytes = 0
  logsShipped=0
  httpFailed=0
  retransmit=0
  if (fileManager) {
    var msg = formatObject(fileManager.stats)
    if (msg) {
      consoleLogger.log('Lines read: ' + msg)  
    }
    Object.keys(fileManager.stats).forEach(function (file) {
      fileManager.stats[file]=0
    })  
  }
  
}
process.once('SIGINT', function () { terminate('SIGINT') })
process.once('SIGQUIT', function () { terminate('SIGQUIT') })
process.once('SIGTERM', function () { terminate('SIGTERM') })

function terminate (reason) {
  consoleLogger.log('terminate reason: ' + reason)
  if (argv.heroku && reason !== 'exitWorker') {
    return
  }
  if (fileManager) {
    fileManager.terminate()  
  }
  if (argv.suppress) {
    printStats()
  }
  process.nextTick(function () {
    Object.keys(loggers).forEach(function (l, i) {
      consoleLogger.log('send ' + l)
      loggers[l].send()
    })
  })
  setTimeout(function () {
    process.exit()
  }, Number(process.env.SIGTERM_TIMEOUT) || 5000)
}

function cli () { 
  if (argv.print_stats || argv.verbose) {
    setInterval(printStats, ((Number(argv.print_stats)) || 60) * 1000)
    printStats()
  }
  if (argv['rtailWebPort']) {
    var rtailServer = require('../lib/cli/rtailServer')(argv)
  }
  if (argv.cfhttp) {
    var throng = require('throng')
    throng({
      workers: WORKERS,
      lifetime: Infinity
    }, startCloudfoundryServer)
  }
  if (argv.heroku) {
    var throng = require('throng')
    throng({
      workers: WORKERS,
      lifetime: Infinity
    }, startHerokuServer)
  }
  if (argv.stdin) {
    readStdIn()
  }
  if (argv.args.length > 0) {
    // tail files
    fileManager.tailFiles(argv.args)
  }
  if (globPattern) {
    // checks for file list and start tail for all files
    // remove quotes and spaces
    globPattern=globPattern.replace(/"/g, '').replace(/'/g,'').replace(/\s/g, '')
    consoleLogger.log('using glob pattern: ' + globPattern)
    fileManager.tailFilesFromGlob(globPattern, 60000)
  } 
  if (argv.udp) {
    try {
      var getSyslogServer = require('../lib/cli/syslog.js')
      getSyslogServer(logseneToken, argv.udp, parseLine, log)
    } catch (err) {
      consoleLogger.error(err)
      process.exit(-1)
    }
  } 
  if (!argv.glob && !argv.udp && !(argv.args.length>0)) {
    readStdIn()
  }
}
