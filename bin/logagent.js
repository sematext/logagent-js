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
var consoleLogger = require('../lib/util/logger.js')
var StatsPrinter = require('../lib/core/printStats.js')
var LogAnalyzer = require('../lib/parser/parser.js')

var mkpath = require('mkpath')

function LaCli (options) {
  this.eventEmitter = require('../lib/core/logEventEmitter.js')
  this.logseneDiskBufferDir = null
  this.fileManager = null
  this.la = null
  this.throng = null
  this.argv = options || require('../lib/core/cliArgs.js')
  this.globPattern = this.argv.glob || process.env.GLOB_PATTERN
  this.logseneToken = this.argv.index || process.env.LOGSENE_TOKEN
  this.loggers = {}
  this.WORKERS = process.env.WEB_CONCURRENCY || 1

  this.removeAnsiColor = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  this.laStats = StatsPrinter
  this.initState()
}

LaCli.prototype.initPugins = function (plugins) {
  var eventEmitter = require('../lib/core/logEventEmitter')
  this.plugins = []
  plugins.forEach(function (pluginName) {
    try {
      var Plugin = require(pluginName)
      var p = new Plugin(this.argv, eventEmitter)
      this.plugins.push(p)
      p.start()
    } catch (err) {
      consoleLogger.error('Error loading plugin: ' + pluginName + ' ' + err.stack)
    }
  }.bind(this))
}

LaCli.prototype.loadInputPlugins = function (configFile, inputName) {
  if (!configFile) {
    return
  }
  if (configFile[inputName].module) {
    plugin = require(configFile[inputName].module)
  }
}
LaCli.prototype.loadPlugins = function (configFile) {
  var plugins = [
    '../lib/plugins/input/files',
    '../lib/plugins/input/stdin',
    '../lib/plugins/input/syslog',
    '../lib/plugins/input/heroku',
    '../lib/plugins/input/cloudfoundry',
    '../lib/plugins/output/elasticsearch',
    '../lib/plugins/output/stdout',
  ]
  if (!configFile) {
    return plugins
  }

  var inputSections = Object.keys(configFile.input)
  inputSections.forEach(function (key) {
    if (configFile.input[key].module) {
      console.log('add ' + configFile.input[key].module + ' to plugin list')
      plugins.push(configFile.input[key].module)
    }
  })
  var outputSections = Object.keys(configFile.input)
  outputSections.forEach(function (key) {
    if (configFile.input[key].module) {
      plugins.push(configFile.input[key].module)
    }
  })
  return plugins
}

LaCli.prototype.initState = function () {
  var eventEmitter = this.eventEmitter
  var self = this
  var plugins = self.loadPlugins(this.argv.configFile)
  self.initPugins(plugins)

  self.logseneDiskBufferDir = self.argv['diskBufferDir'] || process.env.LOGSENE_TMP_DIR || require('os').tmpdir()
  mkpath(self.logseneDiskBufferDir, function (err) {
    if (err) {
      console.error('ERROR: create diskBufferDir (' + self.logseneDiskBufferDir + '): ' + err.message)
    }
  })

  this.la = new LogAnalyzer(self.argv.patternFiles, {}, function laReadyCb (lp) {
    if (self.argv.patterns && (self.argv.patterns instanceof Array)) {
      lp.patterns = self.argv.patterns.concat(lp.patterns)
    }
    if (self.argv.includeOriginalLine) {
      lp.cfg.originalLine = (self.argv.includeOriginalLine === 'true')
    }
    self.cli()
  })
  self.eventEmitter.on('data.raw', function parseRaw (line, context) {
    var trimmedLine = line
    if (line && Buffer.byteLength(line, 'utf8') > self.argv.maxLogSize) {
      var cutMsg = new Buffer(self.argv.maxLogSize)
      cutMsg.write(line)
      trimmedLine = cutMsg.toString()
    }
    self.laStats.bytes = self.laStats.bytes + Buffer.byteLength(line, 'utf8')
    self.laStats.count++

    self.la.parseLine(
      trimmedLine.replace(self.removeAnsiColor, ''),
      context.sourceName || self.argv.sourceName,
      function parserCb (err, data) {
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
            eventEmitter.parsedEvent(filteredData, context)
          }
        }
      })
  })
  process.once('SIGINT', function () { self.terminate('SIGINT') })
  process.once('SIGQUIT', function () { self.terminate('SIGQUIT')})
  process.once('SIGTERM', function () { self.terminate('SIGTERM')})
  process.once('beforeExit', self.terminate)
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
  var bufLength = Buffer.byteLength(line, 'utf8')
  if (line && bufLength > this.argv.maxLogSize) {
    var cutMsg = new Buffer(this.argv.maxLogSize)
    cutMsg.write(line)
    trimmedLine = cutMsg.toString()
  }
  this.laStats.bytes = this.laStats.bytes + bufLength
  this.laStats.count++
  this.la.parseLine(
    trimmedLine.replace(this.removeAnsiColor, ''),
    this.argv.sourceName || sourceName,
    cbf || this.log.bind(this))
}

LaCli.prototype.parseChunks = function (chunk, enc, callback) {
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
  var terminateCounter = this.plugins.length - 1
  function callBackWithATimeout (callback, timeout) {
    var run, timer
    run = function () {
      if (timer) {
        clearTimeout(timer)
        timer = null
        callback.apply(this, arguments)
      }
    }
    timer = setTimeout(run, timeout, 'timeout')
    return run
  }
  this.plugins.forEach(function pluginStop (p) {
    if (p.stop) {
      try {
        p.stop(callBackWithATimeout(function () {
          terminateCounter--
          if (terminateCounter == 0) {
            process.exit()
          }
        }, 5000))
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
  setTimeout(process.exit, 10000)
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
