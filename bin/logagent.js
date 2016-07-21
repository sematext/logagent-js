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
var LogAnalyzer = require('../lib/index.js')


var mkpath = require('mkpath')

function LaCli (options) {
  this.eventEmitter = require('../lib/cli/logEventEmitter.js')
  this.logseneDiskBufferDir = null
  this.fileManager = null
  this.la = null
  this.throng = null
  this.argv = options || require('../lib/cli/cliArgs.js')
  this.globPattern = this.argv.glob || process.env.GLOB_PATTERN
  this.logseneToken = this.argv.index || process.env.LOGSENE_TOKEN
  this.loggers = {}
  this.WORKERS = process.env.WEB_CONCURRENCY || 1
  
  this.removeAnsiColor = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  this.laStats = StatsPrinter
  this.initState()
}

LaCli.prototype.initPugins = function (plugins) {
  this.plugins=[]
  plugins.forEach(function (pluginName) {
    try {
      var Plugin = require(pluginName)
      var p = new Plugin.plugin(this.argv) 
      this.plugins.push(p)
      p.start()
    } catch (err) {
      consoleLogger.error('Error loading plugin: ' + pluginName + ' ' + err.stack)
    }
  }.bind(this))
}

LaCli.prototype.initState = function () {
  this.initPugins([
    '../lib/cli/plugins/input/files',
    '../lib/cli/plugins/input/stdin', 
    '../lib/cli/plugins/input/syslog',
    '../lib/cli/plugins/input/heroku',
    '../lib/cli/plugins/input/cloudfoundry',
    '../lib/cli/plugins/output/elasticsearch',
    '../lib/cli/plugins/output/stdout',
    ])
  this.logseneDiskBufferDir = this.argv['diskBufferDir'] || process.env.LOGSENE_TMP_DIR || require('os').tmpdir()
  mkpath(this.logseneDiskBufferDir, function (err) {
    if (err) {
      console.error('ERROR: create diskBufferDir (' + this.logseneDiskBufferDir + '): ' + err.message)
    }
  }.bind(this))
  
  this.la = new LogAnalyzer(this.argv.patternFiles, {}, function (lp) {
    if (this.argv.patterns && (this.argv.patterns instanceof Array)) {
      lp.patterns = this.argv.patterns.concat(lp.patterns)
    }
    if (this.argv.includeOriginalLine) {
      lp.cfg.originalLine = (this.argv.includeOriginalLine === 'true')
    }
    this.cli()
  }.bind(this))
  this.eventEmitter.on('data.raw', function (line, context) {
    var trimmedLine = line
    if (line && Buffer.byteLength(line, 'utf8') > this.argv.maxLogSize) {
      var cutMsg = new Buffer(this.argv.maxLogSize)
      cutMsg.write(line)
      trimmedLine = cutMsg.toString() 
    }
    this.laStats.bytes = this.laStats.bytes + Buffer.byteLength(line, 'utf8')
    this.laStats.count++
    this.la.parseLine (
      trimmedLine.replace(this.removeAnsiColor, ''),
      context.sourceName || this.argv.sourceName, 
      function (err, data) {
        if (data) {
          if (context.enrichEvent) {
            Object.keys(context.enrichEvent).forEach(function (key) {
              data[key] = context.enrichEvent[key]
            })
          }
          var filteredData = data
          if (context.filter) {
            filteredData = context.filter(data, context)
          }
          if (filteredData) {
            this.eventEmitter.parsedEvent(filteredData, context)
          }
        }
      }.bind(this))
  }.bind(this))
  process.once('SIGINT', function () { this.terminate('SIGINT') }.bind(this))
  process.once('SIGQUIT', function () { this.terminate('SIGQUIT') }.bind(this))
  process.once('SIGTERM', function () { this.terminate('SIGTERM') }.bind(this))
  process.once('beforeExit', this.terminate.bind(this))
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

LaCli.prototype.terminate = function (reason) {
  consoleLogger.log('terminate reason: ' + reason)
  if (this.argv.heroku && reason !== 'exitWorker') {
    return
  }
  if (this.argv.suppress) {
    this.laStats.printStats()
  }
  var terminateCounter = this.plugins.length
  this.plugins.forEach(function(p) {
    if(p.stop) {

      try { 
        p.stop(function () {
          terminateCounter--
          if (terminateCounter == 0) {
            process.exit()
          }
        })
      } catch (err) {
        consoleLogger.error('Error stopping plugin ' + err)
      }
    } else {
      terminateCounter--
      if (terminateCounter == 0) {
        process.exit()
      }
    }
  })
}

LaCli.prototype.cli = function () {
  if (this.argv.printStats || this.argv.verbose) {
    setInterval(this.laStats.printStats.bind(this.laStats), ((Number(this.argv.printStats)) || 60) * 1000)
    this.laStats.printStats()
  }  
}

if (require.main === module) {
  var logagent = new LaCli()
} else {
  module.exports = LaCli
}

