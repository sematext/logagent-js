'use strict'
var split = require('split')
var eventEmitter = require('../../core/logEventEmitter.js')
function InputStdin (config) {
  this.config = config
}
InputStdin.prototype.start = function () {
  if (this.config.stdin || (!this.config.glob && !this.config.udp && !(this.config.args.length > 0))) {
    var context = {name: 'input.stdin', sourceName: this.config.sourceName || 'unknown'}
    process.stdin.pipe(split()).on('data', function (data) {
      eventEmitter.emit('data.raw', data, context)
    }).on('error', console.error)
    process.stdin.on('end', function () {
      process.emit('SIGINT')
    })
  }
}

InputStdin.prototype.stop = function (cb) {
  cb()
}

module.exports = {
  plugin: InputStdin,
  options: null
}
