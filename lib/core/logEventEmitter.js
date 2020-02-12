'use strict'
var EventEmitter = require('eventemitter3')
var util = require('util')

function LogEventEmitter () {
  // text based input
  this.DATA_RAW = 'data.raw'
  // object input, skips input-filters and parser
  this.DATA_OBJECT = 'data.object'
  // after parsing and processing by output-filters
  // ready to store or ship data
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
