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
module.exports = (function () {
  var argv = require('commander')
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
    .option('-v, --verbose', 'output activity report every minute')
    .option('-c, --config <file>', 'load settings from a config file')
    .option('--includeOriginalLine <true/false>', 'true adds the original message to parsed logs')
    .option('-f, --file <patternFile>', 'pattern definition file e.g. patterns.yml', addFile)
    .option('-i, --index <indexName>', 'elasticsearch index')
    .option('-e, --elasticsearchUrl <url>', 'elasticsearch url')
    .option('-n, --name <logSourceName>', 'name stdin log source to find patterns e.g. -n nginx to match nginx patterns', function (n) { argv.sourceName = n })
    .option('-g, --glob <globPattern>', 'glob pattern to match file names')
    .option('--tailStartPosition <pos>', '-1 tail from end of file, >=0 start from given position (in bytes)')
    .option('-s, --suppress', 'supress output of parsed log lines')
    .option('-y, --yaml', 'print parsed logs in YAML format to stdout')
    .option('-p, --pretty', 'print parsed logs in pretty JSON format to stdout')
    .option('-j, --ldjson', 'print parsed logs in line delimited JSON format to stdout')
    .option('--maxLogSize <bytes>', 'limits the size of the message field (default 240k)')
    .option('--maxInputRate <bytes/s>', 'limits the size of the message field (default 240k)', getInputRate)
    .option('--geoipEnabled <value>', 'true/false to enable/disable geoip lookups in patterns')
    .option('--diskBufferDir <directory>', 'directory store status and buffer logs to disk on network failures')
    .option('--httpsProxy <url>', 'URL to a proxy server, which provides TLS on client side')
    .option('--httpProxy <url>', 'URL to a proxy server')
    .option('--docker <docker-socket>', 'path to docker socket')
    .option('--printStats <period>', 'prints activity stats every N seconds, useful in comb. with -s to see activity', parseInt)
    .option('--stdin', 'read logs from stdin (default) when no other input is specified')
    .option('-u, --udp <port>', 'starts UDP syslog listener to receive logs')
    .option('--heroku <port>', 'starts http server to receive logs from a Heroku log drain')
    .option('--cfhttp <port>', 'starts http server to receive logs from a Cloud Foundry log drain')
    .parse(process.argv)

  if (!argv.config) {
    argv.config = process.env.LOGAGENT_CONFIG
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
  if (argv.geoipEnabled === 'true' || argv.geoipEnabled === true) {
    process.env.GEOIP_ENABLED = 'true'
  }
  if (argv.geoipEnabled === 'false' || argv.geoipEnabled === false) {
    process.env.GEOIP_ENABLED = 'false'
  }
  return argv
}())
