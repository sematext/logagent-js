'use strict'
var EventEmitter = require('eventemitter3')
var util = require('util')

function LogEventEmitter () {
  this.DATA_RAW = 'data.raw'
  this.DATA_PARSED = 'data.parsed'
  EventEmitter.call(this)
}
util.inherits(LogEventEmitter, EventEmitter)

LogEventEmitter.prototype.rawDataEvent = function (data, metadata) {
  this.emit(this.DATA_RAW, data, metadata)
}

LogEventEmitter.prototype.parsedEvent = function (data, metadata) {
  this.emit(this.DATA_PARSED, data, metadata)
}

var logEmitter = new LogEventEmitter()

module.exports = logEmitter
