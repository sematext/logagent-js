#!/bin/sh
':' // ; export MAX_MEM="--max-old-space-size=500"; exec "$(command -v node || command -v nodejs)" --harmony "${NODE_OPTIONS:-$MAX_MEM}" "$0" "$@" 
'use strict'
/*
 * See the NOTICE.txt file distributed with this work for additional information 
 * regarding copyright ownership. 
 * Sematext licenses logagent-js to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var consoleLogger = require('../lib/logger.js')
var StatsPrinter = require('../lib/cli/printStats.js')
var TailFileManager = require('../lib/fileManager')
var prettyjson = require('prettyjson')
var LogAnalyzer = require('../lib/index.js')
var Logsene = require('logsene-js')
var dgram = require('dgram')
var mkpath = require('mkpath')


function LaCli (options) {
  this.logseneDiskBufferDir = null
  this.fileManager = null
  this.la = null
  this.throng = null
  this.argv = options || require('../lib/cli/cliArgs.js')
  this.globPattern = this.argv.glob || process.env.GLOB_PATTERN
  this.logseneToken = this.argv.index || process.env.LOGSENE_TOKEN
  this.loggers = {}
  this.WORKERS = process.env.WEB_CONCURRENCY || 1
  this.udpClient = dgram.createSocket('udp4')
  this.removeAnsiColor = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  this.laStats = new StatsPrinter()
  this.initState()
}

LaCli.prototype.initState = function () {
  if (this.argv.heroku || this.argv.cfhttp) {
    this.throng = require('throng')
    this.httpInputs = require('../lib/cli/httpInputs.js')
  }
  this.logseneDiskBufferDir = this.argv['diskBufferDir'] || process.env.LOGSENE_TMP_DIR || require('os').tmpdir()
  mkpath(this.logseneDiskBufferDir, function (err) {
    if (err) {
      console.error('ERROR: create diskBufferDir (' + this.logseneDiskBufferDir + '): ' + err.message)
    }
  }.bind(this))
  // create fileManager only for tail files mode
  if (this.argv.glob || this.argv.args.length > 0) {
    if (!this.fileManager) {
      this.fileManager = new TailFileManager({parseLine: this.parseLine.bind(this), log: this.log.bind(this), logseneTmpDir: this.argv.diskBufferDir})
      this.laStats.fileManger = this.fileManager
    }
  }
  this.la = new LogAnalyzer(this.argv.patternFiles, {}, function (lp) {
    if (this.argv.patterns && (this.argv.patterns instanceof Array)) {
      lp.patterns = this.argv.patterns.concat(lp.patterns)
    }
    if (this.argv.includeOriginalLine) {
      lp.cfg.originalLine = (this.argv.includeOriginalLine === 'true')
    }
    this.cli()
  }.bind(this))
  process.once('SIGINT', function () { this.terminate('SIGINT') }.bind(this))
  process.once('SIGQUIT', function () { this.terminate('SIGQUIT') }.bind(this))
  process.once('SIGTERM', function () { this.terminate('SIGTERM') }.bind(this))
  process.once('beforeExit', this.terminate.bind(this))
}

LaCli.prototype.getLogger = function (token, type) {
  var loggerName = token + '_' + type
  if (!this.loggers[loggerName]) {
    var logger = new Logsene(token, type, this.argv.elasticsearchUrl,
      this.logseneDiskBufferDir)
    this.laStats.usedTokens.push(token)
    logger.on('log', function (data) {
      this.laStats.logsShipped += (Number(data.count) || 0)
    }.bind(this))
    logger.on('error', function (err) {
      this.laStats.httpFailed++
      // if (this.argv.verbose) {
      consoleLogger.error('Error in Logsene request: ' + formatObject(err) + ' / ' + formatObject(err.err))
      // }
    }.bind(this))
    logger.on('rt', function (data) {
      consoleLogger.warn('Retransmit ' + data.file + ' to ' + data.url)
      this.laStats.retransmit += 1
      this.laStats.logsShipped += data.count
    }.bind(this))
    if (process.env.LOG_NEW_TOKENS) {
      consoleLogger.log('create logger for token: ' + token)
    }
    this.loggers[loggerName] = logger
  }
  return this.loggers[loggerName]
}

function _logToLogsene () {
  var logger = this.laCli.getLogger(String(this.token), this.logType)
  var data = this.data
  logger.log(data.level || data.severity || 'info', data.message || data.msg || data.MESSAGE, data)
}

LaCli.prototype.logToLogsene = function (logToken, logType, data) {
  setImmediate(_logToLogsene.bind({
    token: logToken,
    data: data,
    logType: logType,
  laCli: this}))
}

LaCli.prototype.log = function (err, data) {
  if (err && (!data)) {
    this.laStats.emptyLines++
    return
  }
  if (!data) {
    return
  }
  if (this.argv.tokenMapper) {
    var tokenForSource = this.argv.tokenMapper.findToken([data.logSource]) || this.argv.index
    if (tokenForSource) {
      this.logToLogsene(tokenForSource, data['_type'] || 'logs', data)
    }
  } else {
    if (this.argv.index) {
      this.logToLogsene(this.argv.index, data['_type'] || 'logs', data)
    }
  }
  if (this.argv['rtailPort']) {
    var ts = data['@timestamp']
    delete data['@timestamp']
    delete data['originalLine']
    delete data['ts']
    var type = data['logSource']
    delete data['_type']
    var message = new Buffer(JSON.stringify({
      timestamp: ts || new Date(),
      content: data.message,
      id: type || this.argv.sourceName || 'logs'
    }))
    this.udpClient.send(message, 0, message.length, this.argv['rtailPort'], this.argv['rtailHost'] || 'localhost', function (err) {
      // udpClient.close()
    })
  }
  if (this.argv.suppress) {
    return
  }
  if (this.argv.pretty) {
    console.log(JSON.stringify(data, null, '\t'))
  } else if (this.argv.yaml) {
    console.log(prettyjson.render(data, {noColor: false}) + '\n')
  } else {
    console.log(JSON.stringify(data))
  }
}

LaCli.prototype.parseLine = function (line, sourceName, cbf) {
  if (!line && cbf) {
    return cbf(new Error('empty line passed to parseLine()'))
  }
  var trimmedLine = line
  if (line && Buffer.byteLength(line, 'utf8') > this.argv.maxLogSize) {
    var cutMsg = new Buffer(this.argv.maxLogSize)
    cutMsg.write(line)
    trimmedLine = cutMsg.toString() 
  }
  this.laStats.bytes = this.laStats.bytes + Buffer.byteLength(line, 'utf8')
  this.laStats.count++
  this.la.parseLine(trimmedLine.replace(this.removeAnsiColor, ''),
    this.argv.sourceName || sourceName, cbf || this.log.bind(this))
}

LaCli.prototype.parseChunks = function (chunk, enc, callback) {
  console.log(''+chunk)
  this.parseLine(chunk.toString())
  callback()
}
LaCli.prototype.readStdIn = function () {
  var tr = require('through2')
  var split = require('split')
  process.stdin.on('end', this.terminate)
  //process.stdin.pipe(split()).pipe(tr(
  //  this.parseChunks.bind(this)
  //))
  process.stdin.pipe(split()).on('data', function (data) {
    this.parseLine.bind(this)(data)
    // console.log(data)
  }.bind(this))
}

function formatObject (o) {
  var rv = ''
  Object.keys(o).forEach(function (key) {
    rv = rv + ' ' + key + '=' + o[key]
  })
  return rv
}

LaCli.prototype.terminate = function (reason) {
  consoleLogger.log('terminate reason: ' + reason)
  if (this.argv.heroku && reason !== 'exitWorker') {
    return
  }
  if (this.fileManager) {
    this.fileManager.terminate()
  }
  if (this.argv.suppress) {
    this.laStats.printStats()
  }
  process.nextTick(function () {
    var count = Object.keys(this.loggers).length
    Object.keys(this.loggers).forEach(function (l, i) {
      consoleLogger.log('send ' + l)
      this.loggers[l].send()
      this.loggers[l].once('log', function () {
        count = count -1
        consoleLogger.log('flushed logs for ' + l)
        if (count === 0) {
          process.exit()
        }
      }.bind({loggerName: l}))
      this.loggers[l].once('error', function () {
        count = count -1
        consoleLogger.error('flushed logs for ' + l + ' failed')
        if (count === 0) {
          process.exit()
        }
      })
    }.bind(this))
  }.bind(this))
}

LaCli.prototype.cli = function () {
  if (this.argv.printStats || this.argv.verbose) {
    setInterval(this.laStats.printStats.bind(this.laStats), ((Number(this.argv.printStats)) || 60) * 1000)
    this.laStats.printStats()
  }
  if (this.argv['rtailWebPort']) {
    var rtailServer = require('../lib/cli/rtailServer')(this.argv)
  }
  if (this.argv.cfhttp) {
    this.throng({
      workers: this.WORKERS,
      lifetime: Infinity
    }, function () {
      this.httpInputs.startCloudfoundryServer(this)
    }.bind(this))
  }
  if (this.argv.heroku) {
    this.throng({
      workers: this.WORKERS,
      lifetime: Infinity
    }, this.httpInputs.startHerokuServer.bind(this))
  }
  if (this.argv.args.length > 0) {
    // tail files
    this.fileManager.tailFiles(this.argv.args)
  }
  if (this.globPattern) {
    // checks for file list and start tail for all files
    // remove quotes and spaces
    this.globPattern = this.globPattern.replace(/"/g, '').replace(/'/g, '').replace(/\s/g, '')
    consoleLogger.log('using glob pattern: ' + this.globPattern)
    this.fileManager.tailFilesFromGlob(this.globPattern, 60000)
  }
  if (this.argv.udp) {
    try {
      var getSyslogServer = require('../lib/cli/syslog.js')
      var syslogServer = getSyslogServer(this.logseneToken, this.argv.udp, this.parseLine.bind(this), this.log.bind(this))
    } catch (err) {
      consoleLogger.error(err)
      process.exit(-1)
    }
  }
  if (this.argv.stdin || (!this.argv.glob && !this.argv.udp && !(this.argv.args.length > 0))) {
    this.readStdIn()
  }
}

if (require.main === module) {
  var logagent = new LaCli()
} else {
  module.exports = LaCli
}

