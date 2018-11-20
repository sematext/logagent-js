'use strict'
var safeStringify = require('fast-safe-stringify')
var mqtt = require('mqtt')
var consoleLogger = require('../../util/logger.js')

/** example configuration
  output:
    module: mqtt
    url: mqtt://127.0.0.1:1883
    topic: all_events
    filter:
      field: logSource
      match: sensor.*
*/
function OutputMqtt (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (this.config.filter && this.config.filter.match && this.config.filter.field) {
    this.config.filter.match = RegExp(this.config.filter.match)
  }
}
module.exports = OutputMqtt

OutputMqtt.prototype.eventHandler = function (data, context) {
  var msg = safeStringify(data)
  var topic = this.config.topic
  if (this.config.dynamicTopic !== undefined) {
    topic = eval(this.config.dynamicTopic)
    consoleLogger.log('Topic ' + topic)
    if (!topic) {
      if (this.config.debug) {
        consoleLogger.error('MQTT output: Wrong JavaScript expression in dynamicTopic field using fallback topic ' + this.config.topic)
      }
      topic = this.config.topic
    }
  }
  if (this.config.filter !== undefined) {
    // match field with filter expression
    var fieldName = this.config.filter.field || 'logSource'
    var matchValue = data[fieldName] || ''
    var match = this.config.filter.match

    if (match.test(matchValue)) {
      if (this.config.debug === true) {
        consoleLogger.log('mqtt publish -t ' + topic + ' -m ' + msg)
      }
      return this.client.publish(topic, msg)
    } else {
      if (this.config.debug === true) {
        consoleLogger.log('mqtt filter expression' + match + ' did not match ' + matchValue)
      }
    }
  } else {
    // no filter defined, pass all events
    if (this.config.debug === true) {
      consoleLogger.log('mqtt pub -t ' + topic + ' -m ' + msg)
    }
    return this.client.publish(topic, safeStringify(data))
  }
}

OutputMqtt.prototype.start = function () {
  var self = this
  this.client = mqtt.connect(this.config.url)
  this.client.on('close', function () {
    if (self.config.debug) {
      consoleLogger.log('mqtt client connection closed')
    }
  })
  this.client.on('connect', function () {
    if (self.config.debug) {
      consoleLogger.log('mqtt client connect ' + self.config.url)
    }
  })
  this.client.on('reconnect', function () {
    if (self.config.debug) {
      consoleLogger.log('mqtt client re-connect')
    }
  })
  this.client.on('offline', function () {
    if (self.config.debug) {
      consoleLogger.log('mqtt client offline')
    }
  })
  this.client.on('error', function () {
    if (self.config.debug) {
      consoleLogger.log('mqtt client error')
    }
  })
  this.evtFunction = this.eventHandler.bind(this)
  this.eventEmitter.on('data.parsed', this.evtFunction)
  if (self.config.debug) {
    consoleLogger.log('MQTT output plugin started ' + this.config.url)
  }
}

OutputMqtt.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.evtFunction)
  cb()
}
