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
var merge = require('merge')
var yaml = require('js-yaml')
var logger = require('../util/logger')
var fs = require('graceful-fs')
var cfgFiles = null

function mergeConfigs (cfgs) {
  if (!cfgs || cfgs.length === 0) {
    return {
      patterns: [],
      multiline: {
        defaultSeparator: /^\S{2,}/
      }
    }
  }
  var conf = cfgs[0]
  if (!conf.patterns) {
    logger.error('missing patterns section in config ' + conf._fileName)
    conf.patterns = []
  }
  for (var config in cfgs) {
    var tmp = merge.recursive(true, conf, cfgs[config])
    if (!tmp.patterns) {
      logger.error('missing patterns section in config ' + tmp._fileName)
      tmp.patterns = []
    }
    if (!cfgs[config].patterns) {
      cfgs[config].patterns = []
    }
    tmp.patterns = cfgs[config].patterns.concat(conf.patterns)
    conf = tmp
  }
  if (process.env.DEBUG_PATTERN_LOADING === 'true') {
    console.log(yaml.dump(conf))
  }
  return conf
}

function notifyFileChange (event, file) {
  if (event === 'change') {
    this.cb(file)
  }
}

function watchConfigs (files, notifyCallback) {
  files.forEach(function (f) {
    fs.watch(
      f,
      { persistent: false, recursive: false },
      notifyFileChange.bind({ cb: notifyCallback, file: f })
    )
  })
}
function loadConfigFiles (files, notifyCallback) {
  var configs = files.map(function (file) {
    logger.debug('merge pattern file ' + file)
    var cfg = {}
    try {
      if (fs.existsSync(file)) {
        cfg = yaml.load(fs.readFileSync(file, 'utf8'))
        cfg._fileName = file
      } else {
        logger.info('merge patterns file: not found ' + file)
      }
    } catch (e) {
      cfg.patterns = []
      logger.error('ignoring pattern file ' + file + ' ' + e)
      if (e.reason && e.mark) {
        logger.error(
          'Error parsing file: ' +
            file +
            ' ' +
            e.reason +
            ' line:' +
            e.mark.line +
            ' column:' +
            e.mark.columns
        )
      } else {
        // console.log(error.stack)
        logger.debug('Error parsing file: ' + file + ' ' + e + ' ' + e.stack)
      }
    }
    logger.debug(cfg)
    return cfg
  })
  if (notifyCallback && cfgFiles === null) {
    try {
      cfgFiles = files
      watchConfigs(cfgFiles, notifyCallback)
    } catch (err) {
      logger.error('error watching pattern file:' + err)
    }
  }
  return mergeConfigs(configs)
}

// console.log(loadConfigFiles(['./patterns.yml']))
// module.exports.mergeConfigs = mergeConfigs
module.exports = loadConfigFiles
