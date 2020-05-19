'use strict'

var gelfserver = require('graygelf/server')
var safeStringify = require('fast-safe-stringify')

function InputGELF (config, eventEmitter) {
  this.config = config
  this.config.port = config.port || 12100
  this.config.host = config.host || '0.0.0.0'
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
  this.server = gelfserver()
  this.server.listen(this.config.port, this.config.host)
  this.server._udp.on('message', function (buf, rinfo) {
    self.source = rinfo.address + ':' + rinfo.port
  })
  this.server.on('message', function (gelf) {
    self.eventEmitter.emit('data.raw', safeStringify(gelf), {
      sourceName: 'gelf-input : ' + self.source
    })
  })
}
