'use strict'
var prettyjson = require('prettyjson')
var safeStringify = require('fast-safe-stringify')
function OutputStdout (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}

OutputStdout.prototype.eventHandler = function (data, context) {
  if (this.config.suppress) {
    return
  }
  if (this.config.pretty) {
    console.log(JSON.stringify(data, null, '\t'))
  } else if (this.config.yaml) {
    console.log(prettyjson.render(data, { noColor: false }) + '\n')
  } else {
    console.log(safeStringify(data))
  }
}

OutputStdout.prototype.start = function () {
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

OutputStdout.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = OutputStdout
