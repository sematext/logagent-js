'use strict'
var split = require('split')
function InputStdin (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}
InputStdin.prototype.start = function () {
  if (this.config.stdin || (!this.config.glob && !this.config.udp && !(this.config.args.length > 0))) {
    var context = {name: 'input.stdin', sourceName: this.config.sourceName || 'unknown'}
    var eventEmitter = this.eventEmitter
    process.stdin.pipe(split()).on('data', function emitLine (data) {
      eventEmitter.emit('data.raw', data, context)
    }).on('error', console.error)
    process.stdin.on('end', function () {
      process.emit('SIGINT', 0)
    })
  }
}

InputStdin.prototype.stop = function (cb) {
  cb()
}

module.exports = InputStdin
