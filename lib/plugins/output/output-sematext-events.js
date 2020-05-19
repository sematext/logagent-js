'use strict'
const consoleLogger = require('../../util/logger.js')
const request = require('requestretry')
/** example configuration
  output:
    module: output-sematext-events
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

function jsonParse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

class OutputSematextEvents {
  constructor (config, eventEmitter) {
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

  start () {
    this.evtFunction = this.eventHandler.bind(this)
    this.eventEmitter.on('data.parsed', this.evtFunction)
    if (this.config.debug) {
      consoleLogger.log(
        'output-sematext-events plugin started ' + this.config.url
      )
    }
    var sendBuffer = this.sendBuffer.bind(this)
    this.timerId = setInterval(function () {
      sendBuffer()
    }, 1000 * this.config.flushInterval)
  }

  stop (cb) {
    this.eventEmitter.removeListener('data.parsed', this.evtFunction)
    clearInterval(this.timerId)
    cb()
  }

  addTobuffer (line) {
    this.buffer.push(line + '\n')
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.sendBuffer()
    }
  }

  sendBuffer () {
    var httpBody = ''
    for (var i = 0; i < this.buffer.length; i++) {
      httpBody = httpBody + this.buffer[i] + '\n'
    }
    if (httpBody.length > 0) {
      this.buffer = []
      this.send(httpBody)
    }
  }

  send (body) {
    if (this.config.debug) {
      consoleLogger.log(
        'output-sematext-events: ' + body.replace(/\n/g, '\n\t')
      )
    }

    var self = this
    var options = {
      method: 'post',
      url: this.config.eventsReceiver,
      body: body,
      maxAttempts: 20,
      retryDelay: 3000,
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError
    }
    request(options, function (err, response, body) {
      if (response.statusCode === 403) {
        self.eventEmitter.emit('error', jsonParse(body).error)
      }
      if (err) {
        self.eventEmitter.emit('error', err)
      }
      if (self.config.debug === true && response && response.attempts) {
        consoleLogger.log(
          'output-sematext-events: ' +
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
    })
  }

  eventHandler (data, context) {
    if (!context.index) {
      if (this.config.debug === true) {
        consoleLogger.log('output-sematext-events: no token')
      }
      return
    }

    if (this.config.region && this.config.region.toLowerCase() === 'us') {
      this.config.receiver = 'https://event-receiver.sematext.com'
    }
    if (this.config.region && this.config.region.toLowerCase() === 'eu') {
      this.config.receiver = 'https://event-receiver.eu.sematext.com'
    }

    if (!this.config.receiver) {
      if (this.config.debug === true) {
        consoleLogger.log('output-sematext-events: no events receiver URL')
      }
      return
    }

    // build the events receiver from the base receiver URL and the token
    this.config.eventsReceiver = `${this.config.receiver}/${context.index}/event`

    // enrich log with static tags
    if (this.config.tags) {
      data.tags = this.config.tags
    }

    // todo: alternative formats in http body
    const msg = JSON.stringify(data)

    if (this.config.filter !== undefined) {
      // match field with filter expression
      const fieldName = this.config.filter.field || 'logSource'
      const matchValue = data[fieldName] || ''
      const match = this.config.filter.match
      if (match.test(matchValue)) {
        return this.addTobuffer(msg)
      } else {
        if (this.config.debug === true) {
          consoleLogger.log(
            'output-sematext-events: filter expression' +
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
}

module.exports = OutputSematextEvents
