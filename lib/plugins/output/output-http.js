'use strict'
var consoleLogger = require('../../util/logger.js')
var request = require('requestretry')
/** example configuration
  output:
    module: output-http
    url: http://localhost:8080/events
    format: ldjson
    maxBufferSize: 1
    flushInterval: 1
    tags:
      token: SPM_TOKEN
      role: backend
      host: myServerName
    filter:
      field: logSource
      match: sensor.*
*/
function OutputHttp (config, eventEmitter) {
  this.config = config
  this.buffer = []
  this.eventEmitter = eventEmitter
  if (
    this.config.filter &&
    this.config.filter.match &&
    this.config.filter.field
  ) {
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
    this.config.maxBufferSize = 1
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
}
module.exports = OutputHttp

OutputHttp.prototype.start = function () {
  var self = this
  this.evtFunction = this.eventHandler.bind(this)
  this.eventEmitter.on('data.parsed', this.evtFunction)
  if (self.config.debug) {
    consoleLogger.log('output-http plugin started ' + this.config.url)
  }
  var sendBuffer = self.sendBuffer.bind(this)
  this.timerId = setInterval(function () {
    sendBuffer()
  }, 1000 * this.config.flushInterval)
}

OutputHttp.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.evtFunction)
  clearInterval(this.timerId)
  cb()
}

OutputHttp.prototype.addTobuffer = function (line) {
  this.buffer.push(line + '\n')
  if (this.buffer.length >= this.config.maxBufferSize) {
    this.sendBuffer()
  }
}

OutputHttp.prototype.sendBuffer = function () {
  var httpBody = ''
  for (var i = 0; i < this.buffer.length; i++) {
    httpBody = httpBody + this.buffer[i] + '\n'
  }
  if (httpBody.length > 0) {
    this.buffer = []
    this.send(httpBody)
  }
}

OutputHttp.prototype.send = function (body) {
  if (this.config.debug) {
    consoleLogger.log('output-http: ' + body.replace(/\n/g, '\n\t'))
  }
  var self = this
  var options = {
    method: 'post',
    url: this.config.url,
    body: body,
    maxAttempts: 20,
    retryDelay: 3000,
    retryStrategy: request.RetryStrategies.HTTPOrNetworkError
  }
  request(options, function (err, response, body) {
    if (self.config.debug === true && response && response.attempts) {
      consoleLogger.log(
        'output-http: ' +
          response.attempts +
          ' attempts ' +
          ' ' +
          options.url +
          ' ' +
          body +
          ' ' +
          response.statusCode
      )
    }
    if (err) {
      self.eventEmitter.emit('error', err)
    }
  })
}

OutputHttp.prototype.eventHandler = function (data, context) {
  // enrich log with static tags
  if (this.config.tags) {
    data.tags = this.config.tags
  }
  // todo: alternative formats in http body
  var msg = JSON.stringify(data)
  if (this.config.filter !== undefined) {
    // match field with filter expression
    var fieldName = this.config.filter.field || 'logSource'
    var matchValue = data[fieldName] || ''
    var match = this.config.filter.match
    if (match.test(matchValue)) {
      return this.addTobuffer(msg)
    } else {
      if (this.config.debug === true) {
        consoleLogger.log(
          'output-http: filter expression' +
            match +
            ' did not match ' +
            matchValue
        )
      }
    }
  } else {
    return this.addTobuffer(msg)
  }
}
