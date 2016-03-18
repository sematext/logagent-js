#!/bin/sh
':' //; export MAX_MEM="--max-old-space-size=100"; exec "$(command -v node || command -v nodejs)" "${NODE_OPTIONS:-$MAX_MEM}" "$0" "$@" 

// if(process.execArgv.length > 0)
//   console.log('Using NODE_OPTIONS: ' + process.execArgv)

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
    if (cfgArgs !== null)
    {
      console.log('Logagent config file: ' + (process.env.LOGAGENT_CONFIG || '/etc/sematext/logagent.conf'))
    }
    cfgArgs = cfgArgs.split(/\s/)
    cfgArgs = cfgArgs.filter(function(v){
      return v !== ''
    })
    process.argv = [process.argv[0], process.argv[1]].concat(cfgArgs)
    console.log (process.argv)
   } catch (err) {
      // ignore
   } 
 }
 
var argv = require('minimist')(process.argv.slice(2))
var prettyjson = require('prettyjson')
var LogAnalyzer = require('../lib/index.js')
var readline = require('readline')
var begin = new Date().getTime()
var count = 0
var emptyLines = 0
var bytes = 0
var Logsene = require('logsene-js')
var Tail = require('tail-forever')
var fs = require('fs')
var glob = require('glob')
var globPattern = argv.g || process.env.GLOB_PATTERN
var logseneToken = argv.t || process.env.LOGSENE_TOKEN
var http = require('http')
var loggers = {}
var throng = require('throng')
var WORKERS = process.env.WEB_CONCURRENCY || 1
var dgram = require('dgram');
var udpClient = dgram.createSocket('udp4') 
var flat = require('flat')

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
  // var logger = new Logsene(appToken, type || 'logs')
  var Syslogd = require('syslogd')
  var syslogd = Syslogd(function (sysLogMsg) {
    parseLine(sysLogMsg.msg, 'log', function (e, data) {
      data['severity'] = sysLogMsg.severity
      data['syslog-tag'] = sysLogMsg.tag
      data['facility'] = sysLogMsg.facility
      data['hostname'] = sysLogMsg.hostname
      data['@timestamp'] = sysLogMsg['time']
      log(e, data)
    })
  })
  syslogd.listen(port, function (err) {
    console.log('start syslog server ' + port + ' ' + (err || ''))
  })
  return syslogd
// this.servers[appToken] = syslogd
}

function getLogger (token, type) {
  var key = token + type
  // console.log(token)
  if (!loggers[key]) {
    var logger = new Logsene(token, type)
    logger.on('log', function (data) {
      // console.log(data)
    })
    logger.on('error', function (err) {
      console.error('Error in Logsene request:' + err.message)
    })
    loggers[key] = logger
  }
  return loggers[key]
}

function logToLogsene (token, type, data) {
  var logger = getLogger(token, type)
  logger.log(data.level || data.severity || 'info', data.message, data)
}

function getLoggerForToken (token, type) {
  return function (err, data) {
    if (!err && data) {
      log(err, msg)
      delete data.ts
      //delete data.ts
      data['_type'] = type
      var msg = data
      if (type === 'heroku') {
        msg = {
          message: data.message,
          app: data.app,
          host: data.host,
          process_type: data.process_type,
          originalLine: data.origignalLine,
          severity: data.severity,
          facility: data.facility
        }
        var optionalFields = ['method', 'path', 'host', 'request_id', 'fwd', 'dyno', 'connect', 'service', 'status', 'bytes']
        optionalFields.forEach (function (f) {
          if(data[f]) {
            msg[f] = data[f]
          }
        })
        if (!data['@timestamp']) {
          msg['@timestamp'] = new Date()
        }
      }
      console.log(JSON.stringify(msg))
      logToLogsene(token, type, msg)
    }
  }
}

function herokuHandler (req, res) {
  try {
    var path = req.url.split('/')
    var token = null
    if (path.length > 1) {
      if (path[1] && path[1].length > 12) {
        token = path[1]
      }
    }
    console.log(token + '  path:' + path)
    console.log(JSON.stringify(req.headers))
    if (!token) {
      res.end('<html><head><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css"</head><body><div class="alert alert-danger" role="alert">Error: Missing Logsene Token ' 
              + req.url + '. Please use /LOGSENE_TOKEN. More info: <ul><li><a href="https://github.com/sematext/logagent-js#logagent-as-heroku-log-drain">Heroku Log Drain for Logsene</a> </li><li><a href="https://www.sematext.com/logsene/">Logsene Log Management by Sematext</a></li></ul></div></body><html>')
      return
    }
    var body = ''
    req.on('data', function (data) {
      body += data
    })
    req.on('end', function () {
      var lines = body.split('\n')
      console.log(lines)
      lines.forEach(function () {
        parseLine(body, argv.n || 'heroku', function (err, data) {
          if (data) {
            data.headers = req.headers
          }
          getLoggerForToken(token, 'heroku')(err, data)
        })
      })
      res.end('ok\n')
    })
  } catch (err) {
    console.error(err)
  }
}
// heroku start function for WEB_CONCURENCY
function start () {
  getHttpServer(argv.heroku, herokuHandler)
  process.on('SIGTERM', function () {
    terminate('exitWorker')
    console.log('Worker exiting')
  })
}

function cloudFoundryHandler (req, res) {
  var body = ''
  req.on('data', function (data) {
    body += data
  })
  req.on('end', function () {
    parseLine(body, argv.n || 'cloudfoundry', log)
    res.end('ok\n')
  })
}
function getHttpServer (port, handler) {
  var _port = port || process.env.PORT
  if (port === true) { // a commadn line flag was set but no port given
    _port = process.env.PORT
  }
  var server = http.createServer(handler)
  console.log('Logagent listening (http): ' + _port)
  return server.listen(_port)
}

function tailFile (file) {
  var tail = new Tail(file, {start: getFilesizeInBytes(file)})
  tail.on('line', function (line) {
    parseLine(line, file, log)
  })
  tail.on('error', function (error) {
    console.log('ERROR: ', error)
  })
  console.log('Watching file:' + file)
  return tail
}

function tailFiles (fileList) {
  fileList.forEach(tailFile)
}

function tailFilesFromGlob (globPattern) {
  if (globPattern) {
    glob(globPattern, function (err, files) {
      if (!err) {
        tailFiles(files)
      } else {
        console.error('Error in glob file patttern ' + globPattern + ': ' + err)
      }
    })
  }
}

function log (err, data) {
  if (!data) {
    emptyLines++
    return
  }
  if (argv.t) {
    logToLogsene(argv.t || logseneToken, data['_type'] || argv.n || 'logs', data)
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
  if(argv['rtail-port']) {
    var ts = data['@timestamp'] 
    delete data['@timestamp']
    delete data['originalLine']
    delete data['ts']
    var type = data['_type']
    delete data['_type']
    var message = new Buffer(JSON.stringify({
      timestamp: ts || new Date(), 
      content: data, //prettyJs(data),
      id: type || argv.n || 'logs'
    })) 
    udpClient.send(message, 0, message.length, argv['rtail-port'], argv['rtail-host']||'localhost', function (err) {
      // udpClient.close();
    })
  }
}

function prettyJs(o) {
  var rv = ''
  var f = flat(o)
  Object.keys(f).forEach(function(key, i) {
    rv += key + ': ' + f[key] + ' '
  })
  return rv
}
function parseLine (line, sourceName, cbf) {
  bytes += line.length
  count++
  la.parseLine(line.replace(
      // remove ansi color codes
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,''), 
      argv.n || sourceName, cbf || log)
}

function readStdIn () {
  var rl = readline.createInterface({
    terminal: false,
    input: process.stdin
  })
  rl.on('line', parseLine)
  rl.on('close', terminate)
  rl.on('finish', terminate)
}

function rtailServer() {
  // console.log(process.argv)
  try {
    process.argv = [process.argv[0], process.argv[1], '--web-port', String(argv['rtail-web-port'])]
    require('rtail/cli/rtail-server.js')
  } catch (err) {
    console.log(err)
    console.log('rtail is not installed. To start rtail server with logagent run:')
    console.log('    npm i rtail -g')
    setTimeout(process.exit, 300)
  }
}

function terminate (reason) {
  if (argv.heroku && reason !== 'exitWorker') {
    return
  }
  var duration = new Date().getTime() - begin
  var throughput = count / (duration / 1000)
  var throughputBytes = (bytes / 1024 / 1024) / (duration / 1000)

  if (argv.s) {
    console.error(duration + ' ms ' + count + ' lines parsed.  ' + throughput.toFixed(0) + ' lines/s ' + throughputBytes.toFixed(3) + ' MB/s - empty lines: ' + emptyLines)
    console.error('Heap Used: ' + (process.memoryUsage().heapUsed / (1024 * 1024)) + ' MB')
    console.error('Heap Total: ' + (process.memoryUsage().heapTotal / (1024 * 1024)) + ' MB')
    console.error('Memory RSS: ' + (process.memoryUsage().rss / (1024 * 1024)) + ' MB')
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
  }, 1000)
}

function cli() {
  if (argv['rtail-web-port']) {
    console.log('loading rtail')
    rtailServer()
  }
  if (argv.cfhttp) {
    getHttpServer(argv.cfhttp, cloudFoundryHandler)
  }
  if (argv.heroku) {
    throng(start, {
      workers: WORKERS,
      lifetime: Infinity
    })
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



