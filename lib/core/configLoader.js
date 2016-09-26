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
var yaml = require('js-yaml')
var logger = require('../util/logger')
var fs = require('fs')
var flat = require('flat')
var LogSourceToIndexMapper = require('./logSourceToIndexMapper.js')

function loadConfig (file, convertToCli, argv) {
  var cfg = {}
  try {
    cfg = yaml.load(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    logger.error('ignoring config file ' + file + ' ' + e)
    if (e.reason && e.mark) {
      logger.error('Error parsing file: ' + file + ' ' + e.reason + ' line:' + e.mark.line + ' column:' + e.mark.columns)
    } else {
      logger.error('Error parsing file: ' + file + ' ' + e + ' ' + e.stack)
    }
    // config format invalid
    process.exit(-1)
  } finally {
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
  }
}
function convertToCliArgs (cfg, argv) {
  var flatCfg = flat(cfg)
  argv.configFile = cfg
  if (cfg.input) {
    setProperty(flatCfg, argv, 'input.syslog.port', 'udp')
    setProperty(flatCfg, argv, 'input.heroku.port', 'heroku')
    setProperty(flatCfg, argv, 'input.cloudFoundry.port', 'cfhttp')
    if (cfg.input.files && cfg.input.files.length > 1) {
      argv.glob = '{' + cfg.input.files.join(',') + '}'
    }
    if (cfg.input.files && cfg.input.files.length === 1) {
      argv.glob = cfg.input.files[0]
    }
  }
  if (cfg.parser && cfg.parser.patternFiles !== null) {
    argv.patternFiles = cfg.parser.patternFiles
    argv.patterns = cfg.parser.patterns
    setProperty(flatCfg, argv, 'parser.globalTransform', 'patternsGlobalTransform')
  }
  if (cfg.options) {
    setProperty(flatCfg, argv, 'options.geoipEnabled', 'geoipEnabled')
    setProperty(flatCfg, argv, 'options.suppress', 'suppress')
    setProperty(flatCfg, argv, 'options.printStats', 'printStats')
    setProperty(flatCfg, argv, 'options.maxLogSize', 'maxLogSize')
    setProperty(flatCfg, argv, 'options.verbose', 'verbose')
    setProperty(flatCfg, argv, 'options.diskBufferDir', 'diskBufferDir')
    setProperty(flatCfg, argv, 'options.includeOriginalLine', 'includeOriginalLine')
  }
  if (cfg.output) {
    setProperty(flatCfg, argv, 'output.elasticsearch.url', 'elasticsearchUrl')
    setProperty(flatCfg, argv, 'output.elasticsearch.index', 'index')
    setProperty(flatCfg, argv, 'output.elasticsearch.httpProxy', 'httpProxy')
    setProperty(flatCfg, argv, 'output.elasticsearch.httpsProxy', 'httpsProxy')
    setProperty(flatCfg, argv, 'output.elasticsearch.diskBufferDir', 'logseneTmpDir')
    setProperty(flatCfg, argv, 'output.elasticsearch.maxLogSize', 'maxLogSize')
    setProperty(flatCfg, argv, 'output.rtail.udpPort', 'rtailPort')
    setProperty(flatCfg, argv, 'output.rtail.host', 'rtailHost')
    setProperty(flatCfg, argv, 'output.rtail.webPort', 'rtailWebPort')
    setProperty(flatCfg, argv, 'output.rtail.webHost', 'rtailWebHost')
    setProperty(flatCfg, argv, 'output.file.format', 'format')
    if (cfg.output.elasticsearch) {
      argv.indices = cfg.output.elasticsearch.indices
      if (argv.indices) {
        argv.tokenMapper = new LogSourceToIndexMapper(argv.indices)
      }
    }
    if (flatCfg['output.stdout']) {
      // should set yaml, pretty, ldjson
      argv[flatCfg['output.stdout']] = true
    }
  }
  return argv
}
module.exports = loadConfig
