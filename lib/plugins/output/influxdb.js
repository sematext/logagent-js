'use strict'
var safeStringify = require('fast-safe-stringify')
var mqtt = require('mqtt')
var consoleLogger = require('../../util/logger.js')
var json2influx = require('json-influx').convert
var flatten = require('flat')
var request = require('requestretry')

/** example configuration
  output:
    module: output-influxdb
    url: influx://127.0.0.1:1883
    topic: all_events
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
}
module.exports = OutputInflux

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
      console.log('The number of request attempts: ' + response.attempts + ' ' + options.url)
    }
    if (err) {
      self.eventEmitter.emit('error', err)
      cb(err)
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
    maxAttempts: 20, // try 20 times
    retryDelay: 30000, // wait for 60s before trying again
    retryStrategy: request.RetryStrategies.HTTPOrNetworkError
  }
  console.log(options.body)
  request(options, function (err, response, body) {
    if (self.config.debug === true && response && response.attempts) {
      console.log('The number of request attempts: ' + response.attempts + ' ' + options.url + ' ' + body)
    }
    if (err) {
      self.eventEmitter.emit('error', err)
    }
    if (cb) {
      cb(err, response, body)
    }
  })
}

OutputInflux.prototype.send = function (body) {
  if (this.config.debug) {
    console.log(body)
  }
  var self = this
  var options = {
    method: 'post',
    url: this.config.url + '/write?db=' + self.config.db,
    body: body,
    maxAttempts: 20, // try 20 times
    retryDelay: 30000, // wait for 60s before trying again
    retryStrategy: request.RetryStrategies.HTTPOrNetworkError
  }
  request(options, function (err, response, body) {
    if (self.config.debug === true && response && response.attempts) {
      console.log('The number of request attempts: ' + response.attempts + ' ' + options.url + ' ' + body + ' ' + response.statusCode)
    }
    if (err) {
      self.eventEmitter.emit('error', err)
    }
  })
}

OutputInflux.prototype.convertToInflux = function (data, context) {
  var flat = flatten(data)
  var tags = {}
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
  console.log(tags)
  return {
    measurement: data.measurement || data.logSource || 'unknown',
    ts: ts,
    tags: tags,
    fields: fields
  }
}

OutputInflux.prototype.eventHandler = function (data, context) {
  var msg = this.convertToInflux(data, context)
  msg = json2influx(msg)
  if (this.config.filter !== undefined) {
    // match field with filter expression
    var fieldName = this.config.filter.field || 'logSource'
    var matchValue = data[fieldName] || ''
    var match = this.config.filter.match
    if (match.test(matchValue)) {
      return this.send(msg)
    } else {
      if (this.config.debug === true) {
        consoleLogger.log('influx filter expression' + match + ' did not match ' + matchValue)
      }
    }
  } else {
    return this.send(msg)
  }
}

OutputInflux.prototype.start = function () {
  var self = this
  self.ping(function (err, res) {
    if (err) {
      consoleLogger.error('influxdb: connection error in ping: ' + self.config.url + '/ping')
    }
  })
  self.createDb(function (err, res, body) {
    if (err) {
      consoleLogger.error('influxdb: CREATE DATABASE error ' + self.config.url + '/ping :' + err)
    }
  })
  this.evtFunction = this.eventHandler.bind(this)
  this.eventEmitter.on('data.parsed', this.evtFunction)
  if (self.config.debug) {
    consoleLogger.log('InfluxDB output plugin started ' + this.config.url)
  }
}

OutputInflux.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.evtFunction)
  cb()
}
