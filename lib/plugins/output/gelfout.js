'use strict'
var graygelf = require('graygelf')

function OutputGELF (config, eventEmitter) {
  this.config = config
  this.config.port = config.port || 12100
  this.config.host = config.host || '0.0.0.0'
  this.compression = config.compression || 'deflate'
  this.chunkSize = config.chunkSize || 1024
  this.eventEmitter = eventEmitter
  this.log = graygelf({
    host: this.config.host,
    port: this.config.port,
    compressType: this.compression,
    chunkSize: this.chunkSize
  })
}

OutputGELF.prototype.eventHandler = function (data, context) {
  if (this.config.debug) {
    console.log('context ' + JSON.stringify(context))
  }
  var rawMessage = this.mapData(data, context)
  this.log.raw(rawMessage)
}

OutputGELF.prototype.mapData = function (data, context) {
  var timestamp = data['@timestamp']
  var severity = data['severity'] || 'INFO'
  var message = data['message']
  var srcName = context['name']
  return {
    timestamp: timestamp,
    level: severity,
    full_message: message,
    short_message: 'src:logagent-' + srcName
  }
}

OutputGELF.prototype.start = function () {
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

OutputGELF.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = OutputGELF
