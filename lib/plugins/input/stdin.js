'use strict'
var split = require('split2')
var createStreamThrottle = require('../../util/throttle')
function InputStdin (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}
InputStdin.prototype.start = function () {
  var context = {
    name: 'input.stdin',
    sourceName: this.config.sourceName || 'unknown'
  }
  var eventEmitter = this.eventEmitter
  process.stdin
    .pipe(createStreamThrottle(this.config.maxInputRate))
    .pipe(split())
    .on('data', function emitLine (data) {
      eventEmitter.emit('data.raw', data, context)
    })
    .on('error', console.error)
  if (
    this.config.stdinExitEnabled ||
    (this.config.configFile &&
      this.config.configFile.input &&
      this.config.configFile.input.stdin &&
      this.config.configFile.input.stdin.stdinExitEnabled)
  ) {
    process.stdin.once('end', function () {
      eventEmitter.emit('input.stdin.end', null, context)
    })
  } else {
    // terminate on EOF from stdin deactivated
    process.stdin.on('error', function (err) {
      console.log('stdin error ' + err)
    })
  }
}

InputStdin.prototype.stop = function (cb) {
  cb()
}

module.exports = InputStdin
