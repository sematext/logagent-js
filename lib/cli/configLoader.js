var yaml = require('js-yaml')
var logger = require('./logger')
var fs = require('fs')
var flat = require('flat')

function loadConfig (file, convertToCli, argv) {
  var cfg = {}
  try {
    cfg = yaml.load(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    logger.error('ignoring config file ' + file + ' ' + e)
    if (e.reason && e.mark) {
      logger.error('Error parsing file: ' + file + ' ' + e.reason + ' line:' + e.mark.line + ' column:' + e.mark.columns)
    } else {
      // console.log(error.stack)
      logger.error('Error parsing file: ' + file + ' ' + e + ' ' + e.stack)
    }
  } finally {
    // console.log(config)
    if (convertToCli) {
      return convertToCliArgs(cfg, argv || {})
    } else {
      return cfg
    }
  }
}
function setProperty (flatCfg, argvObj, cfgName, argvName) {
  if (flatCfg[cfgName]) {
    argvObj[argvName] = flatCfg[cfgName]
  } else {
    console.log('no ' + cfgName + ' ' + flatCfg[cfgName])
  }
}
function convertToCliArgs (cfg, argv) {
  var flatCfg = flat(cfg)
  console.log(flatCfg)
  if (cfg.input) {
    setProperty(flatCfg, argv, 'input.syslog.port', 'udpPort')
    setProperty(flatCfg, argv, 'input.heroku.port', 'heroku')
    setProperty(flatCfg, argv, 'input.cloudFoundry.port', 'cfhttp')
    if (cfg.input.files && cfg.input.files.length > 1) {
      argv.glob = '{' + cfg.input.files.join(',') + '}'
    }
    if (cfg.input.files && cfg.input.files.length === 1) {
      argv.glob = cfg.input.files[0]
    }
  }
  if (cfg.patternFiles) {
    argv.patternFiles = cfg.patternFiles
  }
  if (cfg.options) {
    setProperty(flatCfg, argv, 'options.geoipEnabled', 'geoipEnabled')
    setProperty(flatCfg, argv, 'options.suppress', 'suppress')
    setProperty(flatCfg, argv, 'options.printStats', 'print_stats')
    setProperty(flatCfg, argv, 'options.verbose', 'verbose')
  }
  if (cfg.output) {
    setProperty(flatCfg, argv, 'output.elasticsearch.host', 'elasticsearchHost')
    setProperty(flatCfg, argv, 'output.elasticsearch.index', 'index')
    setProperty(flatCfg, argv, 'output.elasticsearch.httpProxy', 'httpProxy')
    setProperty(flatCfg, argv, 'output.elasticsearch.httpsProxy', 'httpsProxy')
    setProperty(flatCfg, argv, 'output.elasticsearch.diskBufferDir', 'logseneTmpDir')
    setProperty(flatCfg, argv, 'output.rtail.udpPort', 'ratailPort')
    setProperty(flatCfg, argv, 'output.rtail.host', 'rtailHost')
    setProperty(flatCfg, argv, 'output.rtail.webPort', 'ratailWebPort')
    setProperty(flatCfg, argv, 'output.rtail.webHost', 'rtailWebHost')
    setProperty(flatCfg, argv, 'output.file.format', 'format')
    if (flatCfg['output.stdout']) {
      // should set yaml, pretty, ldjson
      argv[flatCfg['output.stdout']] = true
    }
  }
  return argv
}
module.exports = loadConfig
