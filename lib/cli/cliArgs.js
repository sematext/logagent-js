var fs = require('fs')
var consoleLogger = require('../logger.js')
module.exports = function () {
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
  argv
    .version(require('../../package.json').version)
    .usage('[options] <logfiles ...>')
    .option('-v, --verbose', 'output activity report every minute')
    .option('-c, --config <file>', 'load settings from a config file')
    .option('--include-original-line <true/false>', 'true adds the original message to parsed logs')
    .option('-f, --file <patternFile>', 'pattern definition file e.g. patterns.yml', addFile)
    .option('-t, --index <indexName>', 'elasticsearch index or Logsene App Token')
    .option('-e, --elasticsearch-host <url>', 'elasticsearch url')
    .option('-n, --name <logSourceName>', 'name stdin log source to find patterns e.g. -n nginx to match nginx patterns', function (n) {argv.sourceName = n})
    .option('-g, --glob <globPattern>', 'glob pattern to match file names')
    .option('-s, --suppress', 'supress output of parsed log lines')
    .option('-y, --yaml', 'print parsed logs in YAML format to stdout')
    .option('-p, --pretty', 'print parsed logs in pretty JSON format to stdout')
    .option('-j, --ldjson', 'print parsed logs in line delimited JSON format to stdout')
    .option('--geoip-enabled <value>', 'true/false to enable/disable geoip lookups in patterns')
    .option('--logsene-tmp-dir <directory>', 'directory store status and buffer logs to disk on network failures')
    .option('--https-proxy <url>', 'URL to a proxy server, which provides TLS on client side')
    .option('--http-proxy <url>', 'URL to a proxy server')
    .option('--print_stats <period>', 'prints activity stats every N seconds, useful in comb. with -s to see activity', parseInt)
    .option('--stdin', 'read logs from stdin (default) when no other input is specified')
    .option('-u, --udp <port>', 'starts UDP syslog listener to receive logs')
    .option('--heroku <port>', 'starts http server to receive logs from a Heroku log drain')
    .option('--cfhttp <port>', 'starts http server to receive logs from a Cloud Foundry log drain')
    .option('--rtail-port <port>', 'forward logs to rtail-server with given udp port')
    .option('--rtail-host <hostname>', 'hostname to forward logs to rtail-server')
    .option('--rtail-web-port <port>', 'starts rtail UI webserver (if installed) - npm i rtail -g)')
    .option('--rtail-web-host <hostname>', "rtail UI webserver and bind hostname\n\t\t\t\tExample: logagent --rtail-web-port 9000 --rtail-port 8989  --rtail-web-host $(hostname) -g '/var/log/**/*.log'")
    .parse(process.argv)

  if (!argv.config) {
    argv.config = process.env.LOGAGENT_CONFIG
  }
  if (argv.config) {
    var cfgLoader = require('./configLoader')
    cfgLoader(argv.config, true, argv)
  } 

  if (argv.elasticsearchHost) {
    process.env.LOGSENE_URL = argv.elasticsearchHost + '/_bulk'
    process.env.LOGSENE_RECEIVER_URL = argv.elasticsearchHost + '/_bulk'
  }
  if (argv.httpProxy) {
    process.env.HTTP_PROXY = argv.httpProxy
  }
  if (argv.httpsProxy) {
    process.env.HTTPS_PROXY = argv.httpsProxy
  }
  process.env.GEOIP_ENABLED = argv.geoipEnabled || 'false'
  return argv
}()
