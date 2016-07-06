'use strict'
var merge = require('merge')
var yaml = require('js-yaml')
var logger = require('./logger')
var fs = require('fs')
var cfgFiles = null

function mergeConfigs (cfgs) {
  var conf = cfgs[0]
  for (var config in cfgs) {
    var tmp = merge.recursive(false, conf, cfgs[config])
    if (!tmp.patterns) {
      logger.error('missing patterns section in config ' + tmp._fileName)
    } else {
      tmp.patterns = cfgs[config].patterns.concat(conf.patterns)  
    }
    conf = tmp
  }
  return conf
}

function notifyFileChange (cur, prev) {
  if (cur.mtime > prev.mtime) {
    this.cb(this.file)
  }
}

function unwatchConfigs (files, notifyCallback) {
  files.forEach(function (f) {
    fs.unwatchFile(f)
  })
}
function watchConfigs (files, notifyCallback) {
  files.forEach(function (f) {
    fs.watchFile(f, notifyFileChange.bind({cb: notifyCallback, file: f}))
  })
}
function loadConfigFiles (files, notifyCallback) {
  if (cfgFiles !== null) {
    unwatchConfigs(cfgFiles)
  }
  var configs = files.map(function (file) {
    logger.debug('merge pattern file ' + file)
    var cfg = {}
    try {
      cfg = yaml.load(fs.readFileSync(file, 'utf8'))
      cfg._fileName=file
    } catch (e) {
      logger.error('ignoring pattern file ' + file + ' ' + e)
      if (e.reason && e.mark) {
        logger.error('Error parsing file: ' + file + ' ' + e.reason + ' line:' + e.mark.line + ' column:' + e.mark.columns)
      } else {
        // console.log(error.stack)
        logger.error('Error parsing file: ' + file + ' ' + e + ' ' + e.stack)
      }
    } finally {
      // console.log(config)
      return cfg
    }
  })
  if (notifyCallback) {
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
