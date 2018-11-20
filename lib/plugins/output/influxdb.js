'use strict'
var consoleLogger = require('../../util/logger.js')
var json2influx = require('json-influx').convert
var flatten = require('flat')
var request = require('requestretry')
var os = require('os')
/** example configuration
  output:
    module: output-influxdb
    url: influx://127.0.0.1:1883
    topic: all_events
    tags:
      token: SPM_TOKEN
      role: backend
      host: myServerName
    filter:
      field: logSource
      match: sensor.*
*/
function OutputInflux (config, eventEmitter) {
  this.config = config
  this.buffer = []
  this.eventEmitter = eventEmitter
  if (this.config.filter && this.config.filter.match && this.config.filter.field) {
    this.config.filter.match = RegExp(this.config.filter.match)
  }
  if (this.config.ignoreFields && this.config.ignoreFields.length > 0) {
    this.ignoreFields = {}
    for (var i = 0; i < this.config.ignoreFields.length; i++) {
      this.ignoreFields[this.config.ignoreFields[i]] = true
    }
  }
  if (this.config.maxBufferSize === undefined) {
    // set default
    this.config.maxBufferSize = 100
  }
  if (this.config.maxBufferSize <= 0) {
    // set default to 100, when buffer size is set to 0 or negative values
    this.config.maxBufferSize = 100
  }
  if (!this.config.flushInterval) {
    // set default 10 seconds
    this.config.flushInterval = 10
  }
  if (this.config.flushInterval < 0.5) {
    // don't allow more than 2 requests per second
    this.config.flushInterval = 1
  }
  if (!this.config.tags) {
    this.config.tags = {
      host: os.hostname()
    }
  } else {
    this.config.tags.host = os.hostname()
  }
}
module.exports = OutputInflux

OutputInflux.prototype.start = function () {
  var self = this
  self.ping()
  self.createDb()
  this.evtFunction = this.eventHandler.bind(this)
  this.eventEmitter.on('data.parsed', this.evtFunction)
  if (self.config.debug) {
    consoleLogger.log('output-influxdb plugin started ' + this.config.url)
  }
  var sendBuffer = self.sendBuffer.bind(this)
  this.timerId = setInterval(function () {
    sendBuffer()
  }, 1000 * this.config.flushInterval)
}

OutputInflux.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.evtFunction)
  clearInterval(this.timerId)
  cb()
}

OutputInflux.prototype.ping = function (cb) {
  var self = this
  var options = {
    method: 'get',
    url: this.config.url + '/ping',
    body: '',
    maxAttempts: 1, // try 1 time
    retryDelay: 500 // wait for 0.5s before trying again
  // retryStrategy: request.RetryStrategies.HTTPOrNetworkError
  }
  request(options, function (err, response, body) {
    if (self.config.debug === true && response && response.attempts) {
      consoleLogger.log('output-influxdb: ' + response.attempts + ' attempts ' + options.url + ' ' + response.statusCode)
    }
    if (err) {
      self.eventEmitter.emit('error', 'output-influxdb: connection error in ping: ' + self.config.url + '/ping ' + err)
      if (cb) {
        cb(err)
      }
    }
  })
}

OutputInflux.prototype.createDb = function (cb) {
  var self = this
  var options = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    method: 'post',
    url: this.config.url + '/query',
    formData: {
      q: 'CREATE DATABASE ' + self.config.db
    },
    maxAttempts: 5,
    retryDelay: 1000,
    retryStrategy: request.RetryStrategies.HTTPOrNetworkError
  }
  request(options, function (err, response, body) {
    if (self.config.debug === true && response && response.attempts) {
      consoleLogger.log('output-influxdb: ' + response.attempts + ' attempts ' + options.url + ' ' + body)
    }
    if (err) {
      self.eventEmitter.emit('error', 'output-influxdb: create database ' + err)
    }
    if (cb) {
      cb(err, response, body)
    }
  })
}

OutputInflux.prototype.addTobuffer = function (influxDbString) {
  this.buffer.push(influxDbString)
  if (this.buffer.length >= this.config.maxBufferSize) {
    this.sendBuffer()
  }
}

OutputInflux.prototype.sendBuffer = function () {
  var httpBody = ''
  for (var i = 0; i < this.buffer.length; i++) {
    httpBody = httpBody + this.buffer[i] + '\n'
  }
  if (httpBody.length > 0) {
    this.buffer = []
    this.send(httpBody)
  }
}

OutputInflux.prototype.send = function (body) {
  if (this.config.debug) {
    consoleLogger.log('output-influxdb: influx line protocol format \n\t' + body.replace(/\n/g, '\n\t'))
  }
  var self = this
  var options = {
    method: 'post',
    url: this.config.url + '/write?db=' + self.config.db,
    body: body,
    maxAttempts: 20,
    retryDelay: 3000,
    retryStrategy: request.RetryStrategies.HTTPOrNetworkError
  }
  request(options, function (err, response, body) {
    if (self.config.debug === true && response && response.attempts) {
      consoleLogger.log('output-influxdb: ' + response.attempts + ' attempts ' + ' ' + options.url + ' ' + body + ' ' + response.statusCode)
    }
    if (err) {
      self.eventEmitter.emit('error', err)
    }
  })
}

OutputInflux.prototype.convertToInfluxFormat = function (data, context) {
  var flat = flatten(data)
  var tags = this.config.tags
  var fields = {}
  var keys = Object.keys(flat)
  var ignoreFields = this.ignoreFields || {}
  var ts = data['@timestamp']
  if (ts && ts.getTime) {
    ts = ts.getTime() * 1000 * 1000
  } else {
    ts = Date.now() * 1000 * 1000
  }
  for (var i in keys) {
    if (ignoreFields[keys[i]] !== true) {
      var value = flat[keys[i]]
      if (value !== undefined && typeof value === 'number') {
        fields[keys[i]] = value
      }
      if (value !== undefined && typeof value === 'string') {
        tags[keys[i]] = value
      }
    }
  }
  if (Object.keys(fields).length === 0) {
    fields['value'] = 0
  }
  return {
    measurement: data.measurement || data.logSource || 'unknown',
    ts: ts,
    tags: tags,
    fields: fields
  }
}

OutputInflux.prototype.eventHandler = function (data, context) {
  var msg = this.convertToInfluxFormat(data, context)
  msg = json2influx(msg)
  if (this.config.filter !== undefined) {
    // match field with filter expression
    var fieldName = this.config.filter.field || 'logSource'
    var matchValue = data[fieldName] || ''
    var match = this.config.filter.match
    if (match.test(matchValue)) {
      return this.addTobuffer(msg)
    } else {
      if (this.config.debug === true) {
        consoleLogger.log('output-influxdb: filter expression' + match + ' did not match ' + matchValue)
      }
    }
  } else {
    return this.addTobuffer(msg)
  }
}
