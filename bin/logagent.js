#!/usr/bin/env node

/*
 * @copyright Copyright (c) Sematext Group, Inc. - All Rights Reserved
 *
 * @licence logparser-js is free-to-use, proprietary software.
 * THIS IS PROPRIETARY SOURCE CODE OF Sematext Group, Inc. (Sematext)
 * This source code may not be copied, reverse engineered, or altered for any purpose.
 * This source code is to be used exclusively by users and customers of Sematext.
 * Please see the full license (found in LICENSE in this distribution) for details on its license and the licenses of its dependencies.
 */

var argv = require('minimist')(process.argv.slice(2))
var prettyjson = require('prettyjson')
var LogAnalyzer = require('../lib/index.js')
var la = new LogAnalyzer(argv.f)
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
  console.log(token)
  if (!loggers[key]) {
    var logger = new Logsene(token, type)
    logger.on('log', function (data) {
      console.log(data)
    })
    logger.on('error', console.error)
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
      // delete data.ts
      // data['_type'] = type
      var msg = data
      if (type === 'heroku') {
        msg = {
          '@timestamp': new Date(),
          message: data.message,
          app: data.app,
          host: data.host,
          severity: data.severity,
          facility: data.facility
        }
      }
      logToLogsene(token, type, msg)
    }
  }
}

function herokuHandler (req, res) {
  var token = req.url.split('/')[1]
  var body = ''
  req.on('data', function (data) {
    body += data
  })
  req.on('end', function () {
    var lines = body.split('\n')
    lines.forEach(function () {
      parseLine(body, argv.n || 'heroku', getLoggerForToken(token, 'heroku'))
    })
    res.end('ok\n')
  })
}

function textMsgBodyHandler (req, res) {
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
  var server = http.createServer(handler)
  return server.listen(port || process.env.PORT)
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
  if (err) {
    return
  }
  if (!data) {
    emptyLines++
    return
  }
  if (argv.t) {
    logToLogsene(argv.t || logseneToken, data['_type']|| argv.n || 'logs', data)
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

function parseLine (line, sourceName, cbf) {
  bytes += line.length
  count++
  la.parseLine(line, argv.n || sourceName, cbf || log)
}

function readStdIn () {
  var rl = readline.createInterface({
    input: process.stdin
  })
  rl.on('line', parseLine)
  rl.on('close', terminate)
}

function terminate () {
  var duration = new Date().getTime() - begin
  var throughput = count / (duration / 1000)
  var throughputBytes = (bytes / 1024 / 1024) / (duration / 1000)

  if (argv.s) {
    console.error(duration + ' ms ' + count + ' lines parsed.  ' + throughput.toFixed(0) + ' lines/s ' + throughputBytes.toFixed(3) + ' MB/s - empty lines: ' + emptyLines)
    console.error('Heap Used: ' + (process.memoryUsage().heapUsed / (1024 * 1024)) + ' MB')
    console.error('Heap Total: ' + (process.memoryUsage().heapTotal / (1024 * 1024)) + ' MB')
    console.error('Memory RSS: ' + (process.memoryUsage().rss / (1024 * 1024)) + ' MB')
  }
  process.exit()
}
if (argv.cfhttp) {
  getHttpServer(argv.cfhttp, textMsgBodyHandler)
}
if (argv.heroku || process.env.PORT) {
  getHttpServer(argv.heroku, herokuHandler)
}
if (argv._.length > 0) {
  // tail files
  console.log(argv._)
  tailFiles(argv._)
} else if (globPattern) {
  // checks for file list and start tail for all files
  console.log('using glob pattern:' + globPattern)
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
