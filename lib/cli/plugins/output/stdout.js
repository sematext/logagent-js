'use strict'
var tr = require('through2')
var split = require('split')
var eventEmitter = require('../../logEventEmitter.js')
var prettyjson = require('prettyjson')

function OutputStdout (config) {
  this.config = config
}

OutputStdout.prototype.eventHandler = function (data, context) {
  if (this.config.suppress) {
    return
  }
  if (this.config.pretty) {
    console.log(JSON.stringify(data, null, '\t'))
  } else if (this.config.yaml) {
    console.log(prettyjson.render(data, {noColor: false}) + '\n')
  } else {
    console.log(JSON.stringify(data))
  }
}

OutputStdout.prototype.start = function () {
  eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

OutputStdout.prototype.stop = function (cb) {
  eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = {
  plugin: OutputStdout,
  options: [{
    cfgName: 'output.stdout',
    commanderName: 'yaml',
    commanderOptions: ['--yaml', 'print parsed logs in YAML format to stdout']
  }, {
    cfgName: 'output.stdout',
    commanderName: 'pretty',
    commanderOptions: ['-p, --pretty', 'print parsed logs in pretty JSON format to stdout']
  }, {
    cfgName: 'output.stdout',
    commanderName: 'ldjson',
    commanderOptions: ['-j, --ldjson', 'print parsed logs in line delimited JSON format to stdout']
  }
  ]
}
