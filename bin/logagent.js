#!/bin/sh
':' // ; export MAX_MEM="--max-old-space-size=500"; exec "$(command -v node || command -v nodejs)" "${NODE_OPTIONS:-$MAX_MEM}" "$0" "$@" 
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
var fs = require('fs')
if (process.argv.length === 2) {
  try {
    // read cli paramters from config file
    var cfgArgs = fs.readFileSync(process.env.LOGAGENT_CONFIG || '/etc/sematext/logagent.conf').toString()
    if (cfgArgs !== null) {
      console.log('Logagent config file: ' + (process.env.LOGAGENT_CONFIG || '/etc/sematext/logagent.conf'))
    }
    cfgArgs = cfgArgs.split(/\s/)
    cfgArgs = cfgArgs.filter(function (v) {
      return v !== ''
    })
    process.argv = [process.argv[0], process.argv[1]].concat(cfgArgs)
    console.log(process.argv)
  } catch (err) {
    // ignore -> regular cli mode
  }
}

var argv = require('minimist')(process.argv.slice(2))
var https = require('https')
var http = require('http')
// limit number of socket connections to Logsene
https.globalAgent.maxSockets = Number(process.env.MAX_HTTPS_SOCKETS)||20
var prettyjson = require('prettyjson')
var LogAnalyzer = require('../lib/index.js')
var readline = require('readline')
var begin = new Date().getTime()
var count = 0
var logsShipped = 0
var httpFailed = 0
var emptyLines = 0
var bytes = 0
var Logsene = require('logsene-js')
var Tail = require('tail-forever')
var glob = require('glob')
var globPattern = argv.g || process.env.GLOB_PATTERN
var logseneToken = argv.t || process.env.LOGSENE_TOKEN
var http = require('http')
var loggers = {}
var throng = require('throng')
var WORKERS = process.env.WEB_CONCURRENCY || 1
var dgram = require('dgram')
var udpClient = dgram.createSocket('udp4')
var flat = require('flat')
var logseneDiskBufferDir = argv['logsene-tmp-dir'] || process.env.LOGSENE_TMP_DIR || require('os').tmpdir()
var mkpath = require('mkpath')
mkpath(logseneDiskBufferDir, function (err) {
  if (err) {
    console.error('ERROR: create directory LOGSENE_TMP_DIR (' + logseneDiskBufferDir + '): ' + err.message)
  }
})
var la = new LogAnalyzer(argv.f, {}, function () {
  cli()
})

process.on('beforeExit', function () {})
function getFilesizeInBytes (filename) {
  var stats = fs.statSync(filename)
  var fileSizeInBytes = stats['size']
  return fileSizeInBytes
}

function getSyslogServer (appToken, port, type) {
  var SEVERITY = [
    'emerg',
    'alert',
    'crit',
    'err',
    'warning',
    'notice',
    'info',
    'debug'
  ]
  var FACILITY = [
    'kern',
    'user',
    'mail',
    'daemon',
    'auth',
    'syslog',
    'lpr',
    'news',
    'uucp',
    'cron',
    'authpriv',
    'ftp',
    'ntp',
    'logaudit',
    'logalert',
    'clock',
    'local0',
    'local1',
    'local2',
    'local3',
    'local4',
    'local5',
    'local6',
    'local7'
  ]
  var Syslogd = require('syslogd')
  var syslogd = Syslogd(function (sysLogMsg) {
    parseLine(sysLogMsg.msg, sysLogMsg.tag, function (e, data) {
      data['severity'] = SEVERITY[sysLogMsg.facility]
      data['syslog-tag'] = sysLogMsg.tag
      if (/\#(.+)\#(.+)\#(.+?)\[(\d+)\]/) {
        data['facility'] = FACILITY[sysLogMsg.severity]
      }
      data['host'] = sysLogMsg.address
      log(e, data)
    }, {address: argv.udp_bind_address||'0.0.0.0'})

  })
  //syslogd.server.bind({address: argv.udp_bind_address||'0.0.0.0', port:port})
  syslogd.listen(port, function (err) {
    console.log('start syslog server ' + syslogd.server.address().address + ':' +port + ' ' + (err || ''))

  })
  return syslogd
}

function getLogger (token, type) {
  var key = token + type
  // console.log(token)

  if (!loggers[key]) {
    var logger = new Logsene(token, type, null,
      logseneDiskBufferDir)
    logger.on('log', function (data) {
      logsShipped += (Number(data.count) || 0)
    })
    logger.on('error', function (err) {
      httpFailed++
      console.error('Error in Logsene request: ' + JSON.stringify(err))
    })
    if (process.env.LOG_NEW_TOKENS) {
      console.log('create logger for token: ' + token)
    }
    loggers[key] = logger
  }
  return loggers[key]
}

function _logToLogsene () {
  var logger = getLogger(this.token, this.type)
  var data = this.data
  logger.log(data.level || data.severity || 'info', data.message || data.msg || data.MESSAGE, data) 
}
function logToLogsene (token, type, data) {
  setImmediate(_logToLogsene.bind({token: token, data: data, type:type}))
}

function getLoggerForToken (token, type) {
  return function (err, data) {
    if (!err && data) {
      delete data.ts
      // delete data.ts
      data['_type'] = ('' + type).replace('_' +token, '')
      data['@source'] = ('' + data['@source']).replace('_' +token, '')
      var msg = data
      log(err, msg)
      if (/heroku/.test(type)) {
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
      logToLogsene(token, type, msg)
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
          console.log(new Date() + ': ' + unknownError + ' ' + unknownError.stack)
        }
      })
      res.end('ok\n')
    })
  } catch (err) {
    console.error(new Date() + ': ' + err)
  }
}
// heroku start function for WEB_CONCURENCY
function startHerokuServer () {
  getHttpServer(Number(argv.heroku), herokuHandler)
  process.on('SIGTERM', function () {
    terminate('exitWorker')
    console.log('Worker exiting')
  })
}

// heroku start function for WEB_CONCURENCY
function startCloudfoundryServer () {
  getHttpServer(Number(argv.cfhttp), cloudFoundryHandler)
  process.on('SIGTERM', function () {
    terminate('exitWorker')
    console.log('Worker exiting')
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
      console.log(unknownError.stack)
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
    console.log('Logagent listening (http): ' + _port + ', process id: ' + process.pid)
    return server
  } catch (err) {
    console.log('Port in use (' + _port + '): ' + err)
  }
}

function tailFile (file) {
  var tail = null 
  try {
      tail = new Tail(file, {start: getFilesizeInBytes(file)})
      tail.on('line', function (line) {
        parseLine(line, file, log)
      })
      tail.on('error', function (error) {
        console.log('ERROR tailing file '+file+': ', error.Error || error)
      })
      console.log('Watching file:' + file)
      return tail
  } catch (error) {
    console.log('ERROR tailing file '+file+': ', error)
    return null
  }
}

function tailFiles (fileList) {
  fileList.forEach(tailFile)
}

function tailFilesFromGlob (globPattern) {
  if (globPattern) {
    glob(globPattern, {strict: false, silent: false}, function (err, files) {
      if (!err) {
        tailFiles(files)
      } else {
        console.error('Error in glob file patttern ' + globPattern + ': ' + err.message)
      }
    })
  }
}

function log (err, data) {
  if (err && !data) {
    emptyLines++
    return
  }
  if (argv.t) {
    logToLogsene(argv.t || logseneToken, data['_type'] || argv.n || 'logs', data)
  }
  if (argv['rtail-port']) {
    var ts = data['@timestamp']
    delete data['@timestamp']
    delete data['originalLine']
    delete data['ts']
    var type = data['@source']
    delete data['_type']
    var message = new Buffer(JSON.stringify({
      timestamp: ts || new Date(),
      content: data.message,
      id: type || argv.n || 'logs'
    }))
    udpClient.send(message, 0, message.length, argv['rtail-port'], argv['rtail-host'] || 'localhost', function (err) {
      // udpClient.close()
    })
  }
  if (argv.s) {
    return
  }
  if (argv.p) {
    console.log(JSON.stringify(data, null, '\t'))
  } else if (argv.y) {
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
  la.parseLine(line.replace(
    // remove ansi color codes
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''),
    argv.n || sourceName, cbf || log)
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

function rtailServer () {
  // console.log(process.argv)
  try {
    process.argv = [process.argv[0], process.argv[1], '--web-port', String(argv['rtail-web-port']), '--web-host', process.env.HOSTNAME, '--udp-port', String(argv['rtail-port']), '--udp-host', process.env.HOSTNAME]
    console.log('start rtail server' + process.argv)
    require('rtail/cli/rtail-server.js')
  } catch (err) {
    console.log(err)
    console.log('rtail is not installed. To start rtail server with logagent run:')
    console.log('    npm i rtail -g')
    setTimeout(process.exit, 300)
  }
}

function printStats () {
  var now = new Date().getTime()
  var duration = now - begin
  var throughput = count / (duration / 1000)
  var throughputBytes = (bytes / 1024 / 1024) / (duration / 1000)
  console.error('pid['+process.pid + ']' + ' ' + duration + ' ms ' + count + ' lines parsed.  ' + throughput.toFixed(0) + ' lines/s ' + throughputBytes.toFixed(3) + ' MB/s - empty lines: ' + emptyLines)
  console.error('Tokens used:\t' + Object.keys(loggers).length)
  console.error('Logs shipped:\t' + logsShipped)
  console.error('HTTP failed:\t' + httpFailed)
  console.error('Heap Used:\t' + (process.memoryUsage().heapUsed / (1024 * 1024)) + ' MB')
  console.error('Heap Total:\t' + (process.memoryUsage().heapTotal / (1024 * 1024)) + ' MB')
  console.error('Memory RSS:\t' + (process.memoryUsage().rss / (1024 * 1024)) + ' MB')
  begin = now
  count = 0
  bytes = 0
  logsShipped=0
  httpFailed=0
}

function terminate (reason) {
  if (argv.heroku && reason !== 'exitWorker') {
    return
  }

  if (argv.s) {
    printStats()
  }
  setTimeout(function () {
    // console.log(Object.keys(loggers))
    Object.keys(loggers).forEach(function (l, i) {
      console.log('send ' + l)
      loggers[l].send()
    })
  }, 300)
  setTimeout(function () {
    process.exit()
  }, Number(process.env.SIGTERM_TIMEOUT) || 2000)
}

function cli () {
  if (argv.print_stats) {
    setInterval(printStats, (Number(argv.print_stats) || 30) * 1000)
  }
  if (argv['rtail-web-port']) {
    console.log('loading rtail')
    rtailServer()
  }
  if (argv.cfhttp) {
    throng({
      workers: WORKERS,
      lifetime: Infinity
    }, startCloudfoundryServer)
  }
  if (argv.heroku) {
    throng({
      workers: WORKERS,
      lifetime: Infinity
    }, startHerokuServer)
  }
  if (argv.stdin) {
    readStdIn()
  }
  if (argv._.length > 0) {
    // tail files
    tailFiles(argv._)
  } else if (globPattern) {
    // checks for file list and start tail for all files
    console.log('using glob pattern: ' + globPattern)
    tailFilesFromGlob(globPattern)
  } else if (argv.u) {
    try {
      getSyslogServer(logseneToken, argv.u)
    } catch (err) {
      console.error(err)
      process.exit(-1)
    }
  } else {
    readStdIn()
  }
}
