'use strict'
var EventEmitter2 = require('eventemitter2').EventEmitter2
var util = require('util')
var logger = require('../util/logger.js')
var parser = require('../parser/parser.js')

function LogEventEmitter () {
  this.DATA_RAW = 'data.raw'
  this.DATA_PARSED = 'data.parsed'

  EventEmitter2.call(this, {
    wildcard: true,
    delemiter: '.',
    newListener: true,
    maxListeners: 30
  })
  this.onAny(function (event) {
    logger.debug('Event received:' + JSON.stringify(arguments))
  })
}

LogEventEmitter.prototype.rawDataEvent = function (data, metadata) {
  this.emit(this.DATA_RAW, data, metadata)
}

LogEventEmitter.prototype.parsedEvent = function (data, metadata) {
  this.emit(this.DATA_PARSED, data, metadata)
}

util.inherits(LogEventEmitter, EventEmitter2)

var logEmitter = new LogEventEmitter()
logEmitter.on('input', console.log)
logEmitter.emit('test', 'hi')

module.exports = logEmitter
