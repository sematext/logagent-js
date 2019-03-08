#! /bin/sh
':' // ; export MAX_MEM="--max-old-space-size=300"; exec "$(command -v node || command -v nodejs)" --harmony "${NODE_OPTIONS:-$MAX_MEM}" "$0" "$@"
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
process.on('unhandledRejection', (reason, p) => {
  console.log('Possibly Unhandled Rejection at: Promise ', p, 'reason: ', reason)
})
var consoleLogger = require('../lib/util/logger.js')
var StatsPrinter = require('../lib/core/printStats.js')
var LogAnalyzer = require('../lib/parser/parser.js')
var mkpath = require('mkpath')
process.setMaxListeners(0)
var co = require('co')
const fs = require('fs')
const request = require('request')
var moduleAlias = {
  // inputs
  'command': '../lib/plugins/input/command.js',
  'mysql-query': '../lib/plugins/input/mysql.js',
  'mssql-query': '../lib/plugins/input/mssql.js',
  'postgresql-query': '../lib/plugins/input/postgresql.js',
  'input-tcp': '../lib/plugins/input/tcp.js',
  'input-kafka': 'logagent-input-kafka',
  'input-influxdb-http': '../lib/plugins/input/influxHttp.js',
  'elasticsearch-query': '../lib/plugins/input/elasticsearchQuery.js',
  'input-elasticsearch-http': '../lib/plugins/input/elasticsearchHttp.js',
  'input-gelf': '../lib/plugins/input/gelf.js',
  'input-cloudfoundry': '../lib/plugins/input/cloudfoundry.js',
  'input-heroku': '../lib/plugins/input/heroku.js',
  'input-mqtt-broker': '../lib/plugins/input/mqtt-broker.js',
  'input-mqtt-client': '../lib/plugins/input/mqtt-client.js',
  'input-zeromq': 'logagent-input-zeromq',
  'input-syslog': '../lib/plugins/input/syslog',
  'apple-location': 'logagent-apple-location',
  'cassandra-query': '../lib/plugins/input/cassandra.js',
  'docker-logs': '../lib/plugins/input/docker/docker.js',
  // input filters
  'grep': '../lib/plugins/input-filter/grep.js',
  'grok': 'logagent-input-filter-grok',
  // output filters
  'sql': '../lib/plugins/output-filter/sql.js',
  'access-watch': '../lib/plugins/output-filter/access-watch.js',
  'hash-fields': '../lib/plugins/output-filter/hash-fields.js',
  'aes-encrypt-fields': '../lib/plugins/output-filter/aes-encrypt-fields.js',
  'ip-truncate-fields': '../lib/plugins/output-filter/ip-truncate-fields.js',
  'remove-fields': '../lib/plugins/output-filter/remove-fields.js',
  'docker-enrichment': '../lib/plugins/output-filter/docker-log-enrichment.js',
  // output plugins
  'elasticsearch': '../lib/plugins/output/elasticsearch.js',
  'slack-webhook': '../lib/plugins/output/slack-webhook.js',
  'prometheus-alertmanager': '../lib/plugins/output/prometheus-alertmanager.js',
  'output-kafka': 'logagent-output-kafka',
  'output-files': '../lib/plugins/output/files.js',
  'output-gelf': '../lib/plugins/output/gelfout.js',
  'output-aws-elasticsearch': '../lib/plugins/output/aws-elasticsearch.js',
  'output-mqtt': '../lib/plugins/output/mqtt.js',
  'output-zeromq': 'logagent-output-zeromq',
  'output-influxdb': '../lib/plugins/output/influxdb.js',
  'output-clickhouse': '../lib/plugins/output/clickhouse.js'
}

function downloadPatterns (cb) {
  if (!process.env.PATTERNS_URL) {
    return cb()
  }
  fs.unlink('/etc/logagent/patterns.yml', () => {
    var cbCalled = false
    var patternFileWs = fs.createWriteStream('/etc/logagent/patterns.yml')
    patternFileWs.on('error', (ioerr) => {
      consoleLogger.error('Error writing patterns to /etc/logagent/patterns.yml:' + process.env.PATTERNS_URL + ' ' + ioerr)
      if (!cbCalled) {
        cb(ioerr)
      }
    })
    patternFileWs.on('close', () => {
      consoleLogger.log('Patterns stored in /etc/logagent/patterns.yml (' + process.env.PATTERNS_URL + ')')
      cb()
    })
    try {
      var req = request.get(process.env.PATTERNS_URL)
      req.on('error', (error) => {
        consoleLogger.error('Patterns download failed: ' + process.env.PATTERNS_URL + ' ' + error)
      }).on('response', (response) => {
        consoleLogger.log('Patterns downloaded ' + process.env.PATTERNS_URL + ' ')
      }).pipe(patternFileWs)
    } catch (ex) {
      consoleLogger.error(ex.message)
      cbCalled = true
      cb(ex)
    }
  })
}

function LaCli (options) {
  downloadPatterns(function () {})
  this.eventEmitter = require('../lib/core/logEventEmitter.js')
  this.eventEmitter.on('error', function (err) {
    consoleLogger.error(err)
  })
  this.logseneDiskBufferDir = null
  this.fileManager = null
  this.la = null
  this.throng = null
  this.argv = options || require('../lib/core/cliArgs.js')

  this.globPattern = this.argv.glob || process.env.GLOB_PATTERN
  this.logseneToken = this.argv.index || process.env.LOGSENE_TOKEN || process.env.LOGS_TOKEN
  this.loggers = {}
  this.WORKERS = process.env.WEB_CONCURRENCY || 1
  this.removeAnsiColor = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  this.laStats = StatsPrinter
  this.initState()
}
LaCli.prototype.initFilter = function (type, filterFunctions) {
  consoleLogger.log('init filter: ' + type)
  this[type] = []
  for (var i = 0; i < filterFunctions.length; i++) {
    try {
      var filterName = filterFunctions[i].name || filterFunctions[i].module || 'plugin #' + i
      var ff = null
      if (typeof filterFunctions[i].module === 'function') {
        ff = filterFunctions[i].module
        filterName = String(filterFunctions[i].name || 'plugin #' + i)
      } else {
        ff = require(moduleAlias[filterFunctions[i].module] || filterFunctions[i].module)
      }
      var filter = {
        func: ff,
        config: filterFunctions[i].config || filterFunctions[i] || {}
      }
      this[type].push(filter)
      consoleLogger.log('load ' + type + ': ' + i + ' ' + filterName)
    } catch (err) {
      consoleLogger.error('Error loading plugin: ' + i + ' ' + (filterName || 'undefined') + ' ' + err.message)
    }
  }
}
LaCli.prototype.initPlugins = function (plugins) {
  consoleLogger.log('init plugins')
  var eventEmitter = require('../lib/core/logEventEmitter')
  this.plugins = []
  plugins.forEach(function (plugin) {
    var pluginName = plugin.module || plugin
    consoleLogger.log(pluginName)
    try {
      var Plugin = require(moduleAlias[pluginName] || pluginName)
      // be compatible with plugins accessing config.configFile property
      if (plugin.config) {
        plugin.config.configFile = plugin.globalConfig
      }

      var p = new Plugin(plugin.config || this.argv, eventEmitter)
      this.plugins.push(p)
      p.start.bind(p)()
    } catch (err) {
      consoleLogger.error('Error loading plugin: ' + (moduleAlias[pluginName] || pluginName) + ' ' + err.stack)
    }
  }.bind(this))
}

LaCli.prototype.loadPlugins = function (configFile) {
  var stdOutConfig = {}
  if (configFile && configFile.input && configFile.input.stdout) {
    stdOutConfig = configFile.input.stdout
  } else {
    stdOutConfig = this.argv
  }
  var stdInConfig = {}
  if (configFile && configFile.input && configFile.input.stdout) {
    stdInConfig = configFile.input.stdin
  } else {
    stdInConfig = this.argv
  }
  var plugins = [
    { module: '../lib/plugins/input/stdin', config: stdInConfig, globalConfig: configFile },
    { module: '../lib/plugins/output/stdout', config: stdOutConfig, globalConfig: configFile }
  ]
  // load 3rd paty modules
  if (configFile && configFile.input) {
    var inputSections = Object.keys(configFile.input)
    inputSections.forEach(function (key) {
      consoleLogger.log('add ' + (configFile.input[key].module || key) + ' to plugin list')
      if (configFile.input[key].module) {
        plugins.push({
          module: moduleAlias[configFile.input[key].module] || configFile.input[key].module,
          config: configFile.input[key],
          globalConfig: configFile
        })
      }
    /* if (configFile.input[key].module) {
      consoleLogger.log('add ' + configFile.input[key].module + ' to plugin list')
      plugins.push(moduleAlias[configFile.input[key].module] || configFile.input[key].module)
    } */
    })
  }
  // load input filters
  var inputFilter = []
  if (configFile && configFile.inputFilter) {
    var inputFilterSections = Object.keys(configFile.inputFilter)
    inputFilterSections.forEach(function (key) {
      if (configFile.inputFilter[key].module) {
        inputFilter.push(configFile.inputFilter[key])
      }
    })
  }
  this.initFilter('inputFilter', inputFilter)

  // load output plugins
  if (configFile && configFile.output) {
    var outputSections = Object.keys(configFile.output)
    outputSections.forEach(function (key) {
      if (key === 'elasticsearch' && configFile.output[key].module === undefined) {
        consoleLogger.error('Missing property "module: elasticsearch" in Elasticsearch output configuration')
        configFile.output[key].module = 'elasticsearch'
      }
      if (configFile.output[key].module) {
        plugins.push({
          module: moduleAlias[configFile.output[key].module] || configFile.output[key].module,
          config: configFile.output[key],
          globalConfig: configFile
        })
      }
    })
  }
  // load output filters
  var outputFilter = []
  if (this.argv.docker) {
    plugins.push({
      module: 'docker-logs',
      config: {
        socket: this.argv.docker
      }
    })
    outputFilter.push({
      module: 'docker-enrichment',
      autodetectSeverity: true
    })
  }
  if (configFile && configFile.outputFilter) {
    var outputFilterSections = Object.keys(configFile.outputFilter)
    outputFilterSections.forEach(function (key) {
      if (configFile.outputFilter[key].module) {
        outputFilter.push(configFile.outputFilter[key])
      }
    })
  }
  this.initFilter('outputFilter', outputFilter)
  if (plugins.length === 2) {
    // only stdin/stdout are used and process can terminate
    // when stdin gets closed
    this.argv.stdinExitEnabled = true
  }
  if (this.argv.udp) {
    plugins.push({
      module: '../lib/plugins/input/syslog',
      config: {
        port: this.argv.udp,
        bindAddress: '0.0.0.0'
      }
    })
    this.argv.stdinExitEnabled = false
  }
  if (this.argv.heroku) {
    plugins.push({
      module: '../lib/plugins/input/heroku',
      config: {
        port: this.argv.heroku
      }
    })
    this.argv.stdinExitEnabled = false
  }
  if (this.argv.cfhttp) {
    plugins.push({
      module: '../lib/plugins/input/cloudfoundry',
      config: {
        port: this.argv.cloudfoundry
      }
    })
    this.argv.stdinExitEnabled = false
  }
  if (this.argv.index || this.argv.elasticsearchUrl || this.argv.indices) {
    plugins.push({
      module: '../lib/plugins/output/elasticsearch',
      config: {
        indices: this.argv.indices,
        url: this.argv.elasticsearchUrl,
        index: this.argv.index
      }
    })
  }
  if ((this.argv.args && this.argv.args.length > 0) || this.argv.glob) {
    plugins.push('../lib/plugins/input/files')
    this.argv.stdinExitEnabled = false
  }
  return plugins
}

LaCli.prototype.initState = function () {
  var self = this
  var eventEmitter = self.eventEmitter
  var plugins = self.loadPlugins(this.argv.configFile)
  self.initPlugins(plugins)

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
    var jsonConfigured = (self.argv.configFile !== undefined &&
      self.argv.configFile.parser !== undefined &&
      self.argv.configFile.parser.json !== undefined)
    if (jsonConfigured) {
      lp.cfg.json = self.argv.configFile.parser.json
    }
    if (self.argv.includeOriginalLine !== undefined) {
      lp.cfg.originalLine = self.argv.includeOriginalLine
    }
    self.cli()
  })
  self.eventEmitter.once('input.stdin.end', function endOnStdinEof (line, context) {
    self.terminateRequest = true
    self.terminateReason = 'stdin closed'
  })

  self.tid = setInterval(function () {
    if (self.terminateRequest && Date.now() - self.lastParsedTS > 1500) {
      self.terminate(self.terminateReason)
      clearInterval(self.tid)
    }
  }, 1000)
  self.tid.unref()

  self.eventEmitter.on('data.raw', function parseRaw (line, context) {
    self.lastParsedTS = Date.now()
    var trimmedLine = line
    if (line && Buffer.byteLength(line, 'utf8') > self.argv.maxLogSize) {
      var cutMsg = new Buffer(self.argv.maxLogSize)
      cutMsg.write(line)
      trimmedLine = cutMsg.toString()
    }
    self.laStats.bytes = self.laStats.bytes + Buffer.byteLength(line, 'utf8')
    self.laStats.count++
    co(function * processInput () {
      for (var i = 0; i < self.inputFilter.length; i++) {
        trimmedLine = yield function (callback) {
          self.inputFilter[i].func(context.sourceName || self.argv.sourceName, self.inputFilter[i].config, trimmedLine, callback)
        }
      }
    }).then(function () {
      if (!trimmedLine) {
        return
      }
      function parserCb (err, data) {
        if (err && !data) {
          consoleLogger.error('error during parsing: ' + err.stack)
        }
        if (data) {
          var filteredData = data
          co(function * () {
            for (var i = 0; i < self.outputFilter.length; i++) {
              filteredData = yield function (callback) {
                self.outputFilter[i].func(context, self.outputFilter[i].config, eventEmitter, filteredData, callback)
              }
            }
          }).then(function () {
            if (!filteredData) {
              return
            }
            if (context.enrichEvent) {
              Object.keys(context.enrichEvent).forEach(function (key) {
                data[key] = context.enrichEvent[key]
              })
            }
            if (context.filter) {
              filteredData = context.filter(data, context)
            }
            if (filteredData) {
              self.eventEmitter.parsedEvent(filteredData, context)
            }
          }, function (e) {
            // consoleLogger.error(e.stack)
          })
        }
      }

      setImmediate(function laParse () {
        self.la.parseLine(
          trimmedLine.replace(self.removeAnsiColor, ''),
          context.sourceName || self.argv.sourceName,
          parserCb)
      })
    }, function (e) {
      // consoleLogger.error(e.stack)
    })
  })

  process.once('SIGINT', function () { self.terminate('SIGINT') })
  process.once('SIGQUIT', function () { self.terminate('SIGQUIT') })
  process.once('SIGTERM', function () { self.terminate('SIGTERM') })
  process.once('beforeExit', self.terminate)
  process.once('uncaughtException', function (error) { self.terminate(error.message) })
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
  var terminateCounter = this.plugins.length
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
          if (terminateCounter === 0) {
            setTimeout(process.exit, 5000)
          }
        }, 10 * 1000 * 60))
      } catch (err) {
        consoleLogger.error('Error stopping plugin ' + err)
      }
    } else {
      terminateCounter--
      if (terminateCounter === 0) {
        setTimeout(process.exit, 5000)
      }
    }
  })
  if (!/stdin/.test(reason)) {
    setTimeout(process.exit, 10000)
  }
}

LaCli.prototype.cli = function () {
  if (this.argv.printStats || this.argv.verbose) {
    setInterval(this.laStats.printStats.bind(this.laStats), ((Number(this.argv.printStats)) || 60) * 1000).unref()
    this.laStats.printStats()
  }
}

if (require.main === module) {
  var logagent = new LaCli()
  if (logagent) {
    consoleLogger.log('Logagent initialized')
  }
} else {
  module.exports = LaCli
}
