'use strict'

var gelfserver = require('graygelf/server')
var safeStringify = require('fast-safe-stringify')
var consoleLogger = require('../../util/logger.js')


function InputGELF (config, eventEmitter) {
  this.config = config
  this.config.port = config.port || 12100
  this.config.bindAddress = config.bindAddress || '0.0.0.0'
  this.eventEmitter = eventEmitter
}
module.exports = InputGELF


InputGELF.prototype.start = function () {
  if (!this.started) {
    this.createServer()
    this.started = true
  }
}

InputGELF.prototype.stop = function (cb) {
  this.server.close(cb)
}

InputGELF.prototype.createServer = function () {
  var self = this
  this.server = gelfserver();
  this.server.on('message', function (gelf) {
    //At the moment gelf server doesn't expose rinfo
    self.eventEmitter.emit('data.raw', safeStringify(gelf), {sourceName: 'input-gelf ',source: this.config.bindAddress })
  })  
  this.server.listen(this.config.port ,this.config.bindAddress)
}