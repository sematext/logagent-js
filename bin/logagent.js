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
  console.log(
    'Possibly Unhandled Rejection at: Promise ',
    p,
    'reason: ',
    reason
  )
  console.dir(reason)
})

var clone = require('clone')
var consoleLogger = require('../lib/util/logger.js')
var StatsPrinter = require('../lib/core/printStats.js')
var LogAnalyzer = require('../lib/parser/parser.js')
var mkpath = require('mkpath')
process.setMaxListeners(0)
var co = require('co')
const fs = require('graceful-fs')
const request = require('request')
const PATTERN_DIR = process.env.PATTERN_DIR || '/etc/logagent'
var moduleAlias = {
  // inputs
  command: '../lib/plugins/input/command.js',
  'mysql-query': '../lib/plugins/input/mysql.js',
  'mssql-query': '../lib/plugins/input/mssql.js',
  'postgresql-query': '../lib/plugins/input/postgresql.js',
  'input-tcp': '../lib/plugins/input/tcp.js',
  'input-journald-upload': '../lib/plugins/input/journald-upload.js',
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
  'input-kubernetes-events': '../lib/plugins/input/kubernetesEvents.js',
  'input-kubernetes-audit': '../lib/plugins/input/kubernetesAudit.js',
  'input-docker-events': '../lib/plugins/input/docker/dockerEvents.js',
  'apple-location': 'logagent-apple-location',
  'cassandra-query': '../lib/plugins/input/cassandra.js',
  'docker-logs': '../lib/plugins/input/docker/docker.js',
  'input-github-webhook': '../lib/plugins/input/webhooks/github.js',
  'input-vercel': '../lib/plugins/input/vercel.js',
  'input-aws-ecs': '../lib/plugins/input/aws-ecs.js',
  'azure-event-hub': '../lib/plugins/input/azure-event-hub.js',
  'unix-socket-reader': '../lib/plugins/input/unixSocketReader.js',
  // input filters
  'input-filter-k8s-containerd':
    '../lib/plugins/input-filter/kubernetesContainerd.js',
  grep: '../lib/plugins/input-filter/grep.js',
  grok: 'logagent-input-filter-grok',
  // output filters
  sql: '../lib/plugins/output-filter/sql.js',
  'access-watch': '../lib/plugins/output-filter/access-watch.js',
  'cloudfoundry-format': '../lib/plugins/output-filter/cloudfoundry-format.js',
  'heroku-format': '../lib/plugins/output-filter/heroku-format.js',
  'hash-fields': '../lib/plugins/output-filter/hash-fields.js',
  'aes-encrypt-fields': '../lib/plugins/output-filter/aes-encrypt-fields.js',
  'ip-truncate-fields': '../lib/plugins/output-filter/ip-truncate-fields.js',
  'remove-fields': '../lib/plugins/output-filter/remove-fields.js',
  'rename-fields': '../lib/plugins/output-filter/rename-fields.js',
  'lowercase-fields': '../lib/plugins/output-filter/lowercase-fields.js',
  'drop-events': '../lib/plugins/output-filter/dropEventsFilter.js',
  'docker-enrichment': '../lib/plugins/output-filter/docker-log-enrichment.js',
  'kubernetes-enrichment':
    '../lib/plugins/output-filter/kubernetes-enrichment.js',
  geoip: '../lib/plugins/output-filter/geoip.js',
  httpDeviceDetector: '../lib/plugins/output-filter/httpDeviceDetector.js',
  'journald-format': '../lib/plugins/output-filter/journald-format.js',
  'github-events-format':
    '../lib/plugins/output-filter/github-events-format.js',
  'github-logs-format': '../lib/plugins/output-filter/github-logs-format.js',
  'vercel-format': '../lib/plugins/output-filter/vercel-format.js',
  'aws-ecs-format': '../lib/plugins/output-filter/aws-ecs-format.js',
  // output plugins
  elasticsearch: '../lib/plugins/output/elasticsearch.js',
  'slack-webhook': '../lib/plugins/output/slack-webhook.js',
  'prometheus-alertmanager': '../lib/plugins/output/prometheus-alertmanager.js',
  'output-kafka': 'logagent-output-kafka',
  'output-files': '../lib/plugins/output/files.js',
  'output-gelf': '../lib/plugins/output/gelfout.js',
  'output-aws-elasticsearch': '../lib/plugins/output/aws-elasticsearch.js',
  'output-mqtt': '../lib/plugins/output/mqtt.js',
  'output-zeromq': 'logagent-output-zeromq',
  'output-influxdb': '../lib/plugins/output/influxdb.js',
  'output-clickhouse': '../lib/plugins/output/clickhouse.js',
  'output-http': '../lib/plugins/output/output-http.js',
  'output-sematext-events': '../lib/plugins/output/output-sematext-events.js'
}

function getFunctionArgumentNames (func) {
  // First match everything inside the function argument parens.
  var args = func.toString().match(/function\s.*?\(([^)]*)\)/)[1]
  // Split the arguments string into an array comma delimited.
  return args
    .split(',')
    .map(function (arg) {
      // Ensure no inline comments are parsed and trim the whitespace.
      return arg.replace(/\/\*.*\*\//, '').trim()
    })
    .filter(function (arg) {
      // Ensure no undefined values are added.
      return arg
    })
}

function downloadPatterns (cb) {
  if (!process.env.PATTERNS_URL) {
    return cb()
  }
  var patternFileName = PATTERN_DIR + '/patterns.yml'
  fs.unlink(patternFileName, () => {
    var cbCalled = false
    var patternFileWs = fs.createWriteStream(patternFileName)
    patternFileWs.on('error', ioerr => {
      consoleLogger.error(
        'Error writing patterns to ' +
          patternFileName +
          ': ' +
          process.env.PATTERNS_URL +
          ' ' +
          ioerr
      )
      if (!cbCalled) {
        cb(ioerr)
      }
    })
    patternFileWs.on('close', () => {
      consoleLogger.log(
        'Patterns stored in ' +
          patternFileName +
          ' (' +
          process.env.PATTERNS_URL +
          ')'
      )
      cb()
    })
    try {
      var req = request.get(process.env.PATTERNS_URL)
      req
        .on('error', error => {
          consoleLogger.error(
            'Patterns download failed: ' +
              process.env.PATTERNS_URL +
              ' ' +
              error
          )
        })
        .on('response', response => {
          consoleLogger.log(
            'Patterns downloaded ' + process.env.PATTERNS_URL + ' '
          )
        })
        .pipe(patternFileWs)
    } catch (ex) {
      consoleLogger.error(ex.message)
      cbCalled = true
      cb(ex)
    }
  })
}

function LaCli (options) {
  var self = this
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
  this.logseneToken =
    this.argv.index || process.env.LOGSENE_TOKEN || process.env.LOGS_TOKEN
  this.loggers = {}
  this.WORKERS = process.env.WEB_CONCURRENCY || 1
  this.removeAnsiColor = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  this.laStats = StatsPrinter
  StatsPrinter.eventEmitter = this.eventEmitter
  downloadPatterns(function (err, result) {
    self.initState()
  })
}

LaCli.prototype.initFilter = function (type, filterFunctions) {
  consoleLogger.log('init filter: ' + type)
  this[type] = []
  var defaultCfg = { debug: false }
  var self = this
  for (var i = 0; i < filterFunctions.length; i++) {
    try {
      var filterName =
        filterFunctions[i].name || filterFunctions[i].module || 'plugin #' + i
      var ff = null
      if (typeof filterFunctions[i].module === 'function') {
        ff = filterFunctions[i].module
        filterName = String(filterFunctions[i].name || 'plugin #' + i)
      } else {
        ff = require(moduleAlias[filterFunctions[i].module] ||
          filterFunctions[i].module)
      }
      defaultCfg = {}
      var cfg = filterFunctions[i].config || filterFunctions[i] || defaultCfg
      if (self.argv.verbose !== undefined) {
        cfg.debug = true
        consoleLogger.log('set cfg to debug=true for ' + filterName)
      } else {
        consoleLogger.log('set cfg to debug=false for ' + filterName)
      }

      var filter = {
        func: ff,
        config: filterFunctions[i].config || filterFunctions[i] || defaultCfg,
        argNames: getFunctionArgumentNames(ff)
      }
      // ensure API changes work for input filter, and don't break old input-filters
      if (type === 'inputFilter') {
        if (
          filter.argNames &&
          filter.argNames[0] &&
          filter.argNames[0] === 'context'
        ) {
          filter.useContextObjectAsFirstArgument = true
        }
      }
      this[type].push(filter)
      consoleLogger.log('load ' + type + ': ' + i + ' ' + filterName)
    } catch (err) {
      consoleLogger.error(
        'Error loading plugin: ' +
          i +
          ' ' +
          (filterName || 'undefined') +
          ' ' +
          err.message
      )
    }
  }
}
LaCli.prototype.initPlugins = function (plugins) {
  consoleLogger.log('init plugins')
  var eventEmitter = require('../lib/core/logEventEmitter')
  this.plugins = []
  var self = this
  plugins.forEach(
    function (plugin) {
      var pluginName = plugin.module || plugin
      consoleLogger.log(pluginName)
      try {
        var Plugin = require(moduleAlias[pluginName] || pluginName)
        // be compatible with plugins accessing config.configFile property
        if (plugin.config) {
          plugin.config.configFile = plugin.globalConfig
          if (self.argv.verbose) {
            plugin.config.debug = true
            // plugin.config.configFile.debug = true
          }
        } else {
          if (self.argv.verbose && plugin.config) {
            plugin.config = {
              debug: true
            }
          }
        }
        var p = new Plugin(plugin.config || this.argv, eventEmitter)
        this.plugins.push(p)
        p.start.bind(p)()
      } catch (err) {
        consoleLogger.error(
          'Error loading plugin: ' +
            (moduleAlias[pluginName] || pluginName) +
            ' ' +
            err.stack
        )
      }
    }.bind(this)
  )
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
    {
      module: '../lib/plugins/input/stdin',
      config: stdInConfig,
      globalConfig: configFile
    },
    {
      module: '../lib/plugins/output/stdout',
      config: stdOutConfig,
      globalConfig: configFile
    }
  ]

  if (this.argv.k8sEvents) {
    plugins.push({
      module: 'input-kubernetes-events',
      config: {}
    })
  }

  if (this.argv.dockerEvents) {
    plugins.push({
      module: 'input-docker-events',
      config: {}
    })
  }

  // load 3rd paty modules
  if (configFile && configFile.input) {
    var inputSections = Object.keys(configFile.input)
    inputSections.forEach(function (key) {
      consoleLogger.log(
        'add ' + (configFile.input[key].module || key) + ' to plugin list'
      )
      if (configFile.input[key].module) {
        plugins.push({
          module:
            moduleAlias[configFile.input[key].module] ||
            configFile.input[key].module,
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
        configFile.inputFilter[key].configName = key
        inputFilter.push(configFile.inputFilter[key])
      }
    })
  }
  if (this.argv.k8sContainerd) {
    inputFilter.push({
      module: 'input-filter-k8s-containerd',
      config: {}
    })
  }

  this.initFilter('inputFilter', inputFilter)

  // load output plugins
  if (configFile && configFile.output) {
    var outputSections = Object.keys(configFile.output)
    outputSections.forEach(function (key) {
      if (
        key === 'elasticsearch' &&
        configFile.output[key].module === undefined
      ) {
        consoleLogger.error(
          'Missing property "module: elasticsearch" in Elasticsearch output configuration'
        )
        configFile.output[key].module = 'elasticsearch'
      }
      if (configFile.output[key].module) {
        configFile.output[key].configName = key
        plugins.push({
          module:
            moduleAlias[configFile.output[key].module] ||
            configFile.output[key].module,
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
  if (this.argv.journald) {
    var systemdUnitFilter = process.env.SYSTEMD_UNIT_FILTER || '.*'
    plugins.push({
      module: 'input-journald-upload',
      config: {
        port: this.argv.journald,
        systemdUnitFilter: {
          include: new RegExp(systemdUnitFilter, 'i')
        }
      }
    })
    outputFilter.push({
      module: 'journald-format',
      parseMessageField: true,
      matchSource: new RegExp('journald', 'i')
    })
  }

  if (this.argv.k8sEnrichment) {
    outputFilter.push({
      module: 'kubernetes-enrichment'
    })
  }
  if (this.argv.unixSocket) {
    plugins.push({
      module: 'unix-socket-reader',
      config: {
        path: this.argv.unixSocket
      }
    })
  }
  // note: CLI argument --geoipEnabled overwrites process.env.GEOIP_ENABLED
  if (
    process.env.GEOIP_ENABLED &&
    process.env.GEOIP_ENABLED.toLowerCase() === 'true'
  ) {
    outputFilter.push({
      module: 'geoip',
      fields: this.argv.geoipField || null,
      debug: false
    })
  }
  if (this.argv.geoipEnabled) {
    outputFilter.push({
      module: 'geoip',
      fields: this.argv.geoipField || null,
      debug: false
    })
  }
  if (this.argv.cfhttp) {
    outputFilter.push({
      module: 'cloudfoundry-format'
    })
  }
  if (configFile && configFile.outputFilter) {
    var outputFilterSections = Object.keys(configFile.outputFilter)
    outputFilterSections.forEach(function (key) {
      configFile.outputFilter[key].configName = key
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
        configName: `argv_elasticsearch_${this.argv.elasticsearchUrl}/${this.argv.index}`,
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
  if (self.argv.verbose) {
    process.env.DEBUG = 'true'
    process.env.DEBUG_PATTERN_LOADING = 'true'
  }
  var plugins = self.loadPlugins(this.argv.configFile)
  self.initPlugins(plugins)

  self.logseneDiskBufferDir =
    self.argv.diskBufferDir ||
    process.env.LOGSENE_TMP_DIR ||
    require('os').tmpdir()
  mkpath(self.logseneDiskBufferDir, function (err) {
    if (err) {
      console.error(
        'ERROR: create diskBufferDir (' +
          self.logseneDiskBufferDir +
          '): ' +
          err.message
      )
    }
  })

  this.la = new LogAnalyzer(self.argv.patternFiles, {}, function laReadyCb (
    lp
  ) {
    if (self.argv.patterns && self.argv.patterns instanceof Array) {
      lp.patterns = self.argv.patterns.concat(lp.patterns)
    }
    var jsonConfigured =
      self.argv.configFile !== undefined &&
      self.argv.configFile.parser !== undefined &&
      self.argv.configFile.parser.json !== undefined
    if (jsonConfigured) {
      lp.cfg.json = self.argv.configFile.parser.json
    }
    if (self.argv.includeOriginalLine !== undefined) {
      lp.cfg.originalLine = self.argv.includeOriginalLine
    }
    if (self.argv.verbose !== undefined) {
      lp.cfg.debug = true
    }
    self.cli()
  })

  self.eventEmitter.once('input.stdin.end', function endOnStdinEof (
    line,
    context
  ) {
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

  // shared function to call output-filters and output plugins
  // after parsing of DATA_RAW events and receiving DATA_OBJECT events
  function applyOutputFilters (data, contextObj) {
    if (data) {
      var filteredData = data
      var context = clone(contextObj)
      co(function * () {
        for (var i = 0; i < self.outputFilter.length; i++) {
          filteredData = yield function (callback) {
            self.outputFilter[i].func(
              context,
              self.outputFilter[i].config,
              eventEmitter,
              filteredData,
              callback
            )
          }
        }
      }).then(
        function processOutput () {
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
        },
        function logError (e) {
          // we avoid logging errors for each log line in prod mode
          consoleLogger.debug(e.stack)
        }
      )
    }
  }

  /**
   * DATA_RAW events are emitted by input-plugins, producing text lines,
   * and must be handled by text based input-filters and parser
   **/
  self.eventEmitter.on(eventEmitter.DATA_RAW, function parseRaw (
    line,
    contextObj
  ) {
    self.lastParsedTS = Date.now()
    var context = contextObj
    var trimmedLine = line
    if (line && Buffer.byteLength(line, 'utf8') > self.argv.maxLogSize) {
      var cutMsg = Buffer.alloc(self.argv.maxLogSize)
      cutMsg.write(line)
      trimmedLine = cutMsg.toString()
    }
    self.laStats.bytes = self.laStats.bytes + Buffer.byteLength(line, 'utf8')
    self.laStats.count++
    co(function * processInput () {
      for (var i = 0; i < self.inputFilter.length; i++) {
        trimmedLine = yield function (callback) {
          if (self.inputFilter[i].useContextObjectAsFirstArgument) {
            context = clone(contextObj)
            self.inputFilter[i].func(
              context,
              self.inputFilter[i].config,
              line,
              callback
            )
          } else {
            self.inputFilter[i].func(
              context.sourceName || self.argv.sourceName,
              self.inputFilter[i].config,
              trimmedLine,
              callback
            )
          }
        }
      }
    }).then(
      function processInput () {
        if (!trimmedLine) {
          return
        }
        function parserCb (err, data) {
          if (err && !data) {
            consoleLogger.error('error during parsing: ' + err.stack)
          }
          applyOutputFilters(data, context)
        }

        setImmediate(function laParse () {
          self.la.parseLine(
            trimmedLine.replace(self.removeAnsiColor, ''),
            context.sourceName || self.argv.sourceName,
            parserCb
          )
        })
      },
      function logError (e) {
        // we avoid logging errors for each log line in prod mode
        consoleLogger.debug(e.stack)
      }
    )
  })

  /**
   * DATA_OBJECT events are emitted by input plugins, producing structured data,
   * with no need to be parsed. Such data needs to be processed by output-filters and
   * output plugins
   * Skipping text based input filters and parser, and continue with directly output filters
   * improves performance by saving serialisation to JSON and back to JS objects.
   **/
  self.eventEmitter.on(eventEmitter.DATA_OBJECT, function processObjectData (
    data,
    contextObj
  ) {
    applyOutputFilters(data, contextObj)
  })

  process.once('SIGINT', function () {
    self.terminate('SIGINT')
  })
  process.once('SIGQUIT', function () {
    self.terminate('SIGQUIT')
  })
  process.once('SIGTERM', function () {
    self.terminate('SIGTERM')
  })
  process.once('beforeExit', self.terminate)
  process.once('uncaughtException', function (error) {
    console.dir(error)
    // self.terminate(error)
  })
}

LaCli.prototype.log = function (err, data) {
  if (err && !data) {
    this.laStats.emptyLines++
    return
  }
  if (!data) {
    return
  }
  if (this.argv.tokenMapper) {
    var tokenForSource =
      this.argv.tokenMapper.findToken([data.logSource]) || this.argv.index
    if (tokenForSource) {
      this.logToLogsene(tokenForSource, data._type || 'logs', data)
    }
  } else {
    if (this.argv.index) {
      this.logToLogsene(this.argv.index, data._type || 'logs', data)
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
    var cutMsg = Buffer.alloc(this.argv.maxLogSize)
    cutMsg.write(line)
    trimmedLine = cutMsg.toString()
    cutMsg = null
  }
  this.laStats.bytes = this.laStats.bytes + bufLength
  this.laStats.count++
  this.la.parseLine(
    trimmedLine.replace(this.removeAnsiColor, ''),
    this.argv.sourceName || sourceName,
    cbf || this.log.bind(this)
  )
}

LaCli.prototype.parseChunks = function (chunk, enc, callback) {
  this.parseLine(chunk.toString())
  callback()
}

LaCli.prototype.terminate = function (reason) {
  consoleLogger.error(
    'terminate reason: ' + reason.message + ' ' + reason.stack
  )
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
        p.stop(
          callBackWithATimeout(function () {
            terminateCounter--
            if (terminateCounter === 0) {
              setTimeout(process.exit, 5000)
            }
          }, 10 * 1000 * 60)
        )
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
    setInterval(
      this.laStats.printStats.bind(this.laStats),
      (Number(this.argv.printStats) || 60) * 1000
    ).unref()
    this.laStats.printStats()
  }
}

if (require.main === module) {
  var logagent = new LaCli()
  if (logagent) {
    consoleLogger.log('Logagent initialized')
  }
  var errorCounter
  process.on('uncaughtException', function (err) {
    // uncaughtErrors can happen in dockermodem/docekrode e.g. when Docker daemon restarts
    if (
      String(err).indexOf('Bad response from Docker engine') > -1 ||
      err.code === 'ENOENT'
    ) {
      logagent.terminate({
        message:
          'Lost connection to Docker socket, EXIT_ON_DOCKER_SOCKET_ERROR',
        stack: err.stack
      })
    }
    console.error('Please contact support@sematext.com to report the error:')
    console.error('UncaughtException:' + err + '\n  ' + err.stack)
    errorCounter++
    if (errorCounter > 50) {
      logagent.terminate({
        message: 'more than 50 uncaught errors -> exit.',
        stack: err.stack
      })
    }
  })
} else {
  module.exports = LaCli
}
