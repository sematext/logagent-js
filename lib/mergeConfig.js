'use strict'
var merge = require('merge')
var yaml = require('js-yaml')
var logger = require('./logger')
var fs = require('fs')

function mergeConfigs(cfgs) {
	var conf = cfgs[0]
	for (var config in cfgs) {
		var tmp = merge.recursive(false, conf, cfgs[config]) 
		tmp.patterns = cfgs[config].patterns.concat(conf.patterns)
		conf = tmp
	}
	return conf
}

function loadConfigFiles(files) {
	var conf = {}
	var configs = files.map(function (file) {
		logger.debug('merge pattern file ' + file)
		var cfg = {}
		try {
			cfg = yaml.load(fs.readFileSync(file, 'utf8'))
		} catch (e) {
		  logger.error('ignoring pattern file ' + file + ' ' + e)	
	      if (e.reason && e.mark) {
	        logger.error('Error parsing file: ' + name + ' ' + e.reason + ' line:' + e.mark.line + ' column:' + e.mark.columns)
	      } else {
	        //console.log(error.stack)
	        logger.error('Error parsing file: ' + name + ' ' + e + ' ' + e.stack)
	      }
		} finally {
		  //console.log(config)
		  return cfg	
		}
	})
	return mergeConfigs(configs)
}

//console.log(loadConfigFiles(['./patterns.yml']))
//module.exports.mergeConfigs = mergeConfigs
module.exports = loadConfigFiles

