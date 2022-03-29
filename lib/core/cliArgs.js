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

var fs = require('graceful-fs')
var argv = require('commander')
const consoleLogger = require('../util/logger.js')
function writeConfig (path) {
  try {
    if (path && path.indexOf('-') === 0) {
      throw new Error('Invalid file name ' + path)
    }
    var cfg = fs
      .readFileSync(require.resolve('./../../config/example.yml'))
      .toString()
    if (argv.index) {
      cfg = cfg.replace('YOUR_SEMATEXT_LOGS_TOKEN', argv.index)
    }
    if (argv.glob) {
      if (argv.glob.indexOf('{') === 0) {
        // multiple glob expressions e.g. '{/var/log/**.log,/opt/logs/*.log}'
        var globs = argv.glob.replace(/\{|\}/g, '').split(',')
        var globString = ''
        globs.forEach(function (g, i) {
          if (i === 0) {
            globString = globString + '- ' + g + '\n'
          } else {
            globString = globString + '      - ' + g + '\n'
          }
        })
        cfg = cfg.replace("- '/var/log/**/*.log'", globString)
      } else {
        // one glob string
        cfg = cfg.replace(" - '/var/log/**/.log'", argv.glob)
      }
    }
    if (argv.elasticsearchUrl) {
      cfg = cfg.replace(
        /https:\/\/logsene-receiver.sematext.com/g,
        argv.elasticsearchUrl
      )
    }
    fs.writeFileSync(path, cfg)
    consoleLogger.info('Config file was generated: ' + path)
  } catch (error) {
    consoleLogger.error(error.message)
  }
  process.exit(0)
}

function writePatterns (path) {
  try {
    if (path && path.indexOf('-') === 0) {
      // commander does not recognize missing argument, and might pass following CLI args here
      throw new Error('Invalid file name ' + path)
    }
    var cfg = fs
      .readFileSync(require.resolve('./../../patterns.yml'))
      .toString()
    fs.writeFileSync(path, cfg)
    consoleLogger.info('Patterns file was generated: ' + path)
  } catch (error) {
    consoleLogger.error(error.message)
  }
  process.exit(0)
}

module.exports = (function () {
  var processStreams = [process.stdout, process.stderr]
  processStreams.forEach(function (stream) {
    if (stream._handle && typeof stream._handle.setBlocking === 'function') {
      stream._handle.setBlocking(true)
    }
  })
  argv.patternFiles = []
  function addFile (file) {
    argv.patternFiles.push(file)
  }
  function getInputRate (value) {
    var rate = 1024 * 1024
    var rateStr = ''
    switch (true) {
      case /\d+b/.test(value):
        rateStr = value.replace('b', '')
        rate = Number(rateStr)
        break
      case /\d+kb/.test(value):
        rateStr = value.replace('kb', '')
        rate = Number(rateStr) * 1024
        break
      case /\d+mb/.test(value):
        rateStr = value.replace('mb', '')
        rate = Number(rateStr) * 1024 * 1024
        break
      default:
        rate = Number(value) || 1024 * 1024 * 100
    }
    return rate
  }

  argv
    .version(require('../../package.json').version)
    .usage('[options] <logfiles ...>')
    .option('-v, --verbose', 'verbose debug output for all plugins')
    .option('--skipDefaultPatterns', 'skips loading of default patterns.yml')
    .option('-c, --config <file>', 'load settings from a config file')
    .option(
      '-w, --writeConfig <file>',
      'write example config to a file, using -i,-e,-g args in generated config'
    )
    .option(
      '--includeOriginalLine <true/false>',
      'true adds the original message to parsed logs'
    )
    .option(
      '-f, --file <patternFile>',
      'pattern definition file e.g. patterns.yml',
      addFile
    )
    .option('-i, --index <indexName>', 'elasticsearch index')
    .option('-e, --elasticsearchUrl <url>', 'elasticsearch url')
    .option(
      '-n, --name <logSourceName>',
      'name stdin log source to find patterns e.g. -n nginx to match nginx patterns',
      function (n) {
        argv.sourceName = n
      }
    )
    .option('-g, --glob <globPattern>', 'glob pattern to match file names')
    .option(
      '--tailStartPosition <pos>',
      '-1 tail from end of file, >=0 start from given position (in bytes)'
    )
    .option('-s, --suppress', 'supress output of parsed log lines')
    .option('-y, --yaml', 'print parsed logs in YAML format to stdout')
    .option('-p, --pretty', 'print parsed logs in pretty JSON format to stdout')
    .option(
      '-j, --ldjson',
      'print parsed logs in line delimited JSON format to stdout'
    )
    .option(
      '--maxLogSize <bytes>',
      'limits the size of the message field (default 240k)'
    )
    .option(
      '--maxInputRate <bytes/s>',
      'limits the size of the message field (default 240k)',
      getInputRate
    )
    .option(
      '--geoipEnabled <value>',
      'true/false to enable/disable geoip lookups, default field "client_ip"'
    )
    .option('--geoipField <value>', 'string field name for geoip lookup')
    .option(
      '--diskBufferDir <directory>',
      'directory store status and buffer logs to disk on network failures'
    )
    .option(
      '--httpsProxy <url>',
      'URL to a proxy server, which provides TLS on client side'
    )
    .option('--httpProxy <url>', 'URL to a proxy server')
    .option(
      '--docker <docker-socket>',
      'path to docker socket for container log collection'
    )
    .option(
      '--dockerEvents',
      'collects Docker events from /var/run/docker.sock'
    )
    .option(
      '--k8sContainerd',
      'loads kubernetes containerd input-filter plugin'
    )
    .option('--k8sEvents', 'collects Kubernetes events from Kubernetes API')
    .option('--k8sEnrichment', 'log enrichment via Kubernetes API')
    .option('--unixSocket <path>', 'reading from a unix socket')
    .option(
      '--printStats <period>',
      'prints activity stats every N seconds, useful in comb. with -s to see activity',
      parseInt
    )
    .option(
      '--stdin',
      'read logs from stdin (default) when no other input is specified'
    )
    .option('-u, --udp <port>', 'starts UDP syslog listener to receive logs')
    .option(
      '--heroku <port>',
      'starts http server to receive logs from a Heroku log drain'
    )
    .option(
      '--cfhttp <port>',
      'starts http server to receive logs from a Cloud Foundry log drain'
    )
    .option(
      '--journald <port>',
      'starts http server to receive logs systemd-journal-upload.service'
    )
    .option(
      '--writePatterns <file>',
      'write example patterns.yml to a file',
      writePatterns
    )
    .parse(process.argv)

  if (argv.writeConfig) {
    writeConfig(argv.writeConfig)
  }

  if (!argv.config) {
    argv.config = process.env.LOGAGENT_CONFIG
  }
  if (argv.skipDefaultPatterns) {
    process.env.DISABLE_DEFAULT_PATTERNS = 'true'
  }
  if (argv.config) {
    var cfgLoader = require('./configLoader')
    cfgLoader(argv.config, true, argv)
  }
  if (argv.elasticsearchUrl) {
    process.env.LOGSENE_URL = argv.elasticsearchUrl + '/_bulk'
    process.env.LOGSENE_RECEIVER_URL = argv.elasticsearchUrl + '/_bulk'
  }
  if (argv.httpProxy) {
    process.env.HTTP_PROXY = argv.httpProxy
  }
  if (argv.httpsProxy) {
    process.env.HTTPS_PROXY = argv.httpsProxy
  }
  if (!argv.maxLogSize) {
    argv.maxLogSize = 240 * 1024
  } else {
    argv.maxLogSize = Number(argv.maxLogSize) || 240 * 1024
  }
  // overwrite env var from CLI for logsene-js
  process.LOGSENE_MAX_MESSAGE_FIELD_SIZE = argv.maxLogSize

  if (process.env.GEOIP_ENABLED === 'true' && argv.geoipField === undefined) {
    argv.geoipEnabled = true
  }
  if (argv.geoipEnabled === 'true' || argv.geoipEnabled === true) {
    if (!process.env.GEOIP_ENABLED === 'true') {
      process.env.GEOIP_ENABLED = 'true'
    }
    if (process.env.GEOIP_FIELD && argv.geoipField === undefined) {
      argv.geoipField = process.env.GEOIP_FIELD
    }
    if (argv.geoipField && process.env.GEOIP_FIELD === undefined) {
      process.env.GEOIP_FIELD = argv.geoipField
    }
  }
  if (argv.geoipEnabled === 'false' || argv.geoipEnabled === false) {
    process.env.GEOIP_ENABLED = 'false'
  }
  return argv
})()
