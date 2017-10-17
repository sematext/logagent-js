'use strict'

var gelfserver = require('graygelf/server')
var safeStringify = require('fast-safe-stringify')
var consoleLogger = require('../../util/logger.js')


function InputGELF (config, eventEmitter) {
  this.config = config.configFile.input.gelf
  this.config.port = config.configFile.input.gelf.port || 12100
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
  var port = this.config.port || 4545
  var address = this.config.bindAddress || '0.0.0.0'
  this.server.on('message', function (gelf) {
    //At the moment gelf server doesn't expose rinfo
    self.eventEmitter.emit('data.raw', safeStringify(gelf), {sourceName: 'input-gelf ',source: address })
  })  
  consoleLogger.log('port '+ this.config.port)
  this.server.listen(port,address)
}