'use strict'
var mosca = require('mosca')
var consoleLogger = require('../../util/logger.js')
var ignoreTopicRegEx = /^\$SYS/
/**
 * Constructor called by logagent, when the config file contains tis entry:
 * input
 *  mqtt-broker:
 *    module: mqtt-broker
 *    port: 1883
 *
 * @config cli arguments and config entries
 * @eventEmitter logent eventEmitter object
 */
function InputMqttBroker (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}
module.exports = InputMqttBroker
/**
 * Plugin start function, called after constructor
 *
 */
InputMqttBroker.prototype.start = function () {
  if (!this.started) {
    this.createServer()
    this.started = true
  }
  try {
    if (this.config.ignoreTopic) {
      ignoreTopicRegEx = new RegExp (this.config.ignoreTopic)
    } 
  } catch (error) {
    consoleLogger.error('MQTT config property ignoreTopic is not a Regular Expression:' + err)
  }
}

/**
 * Plugin stop function, called when logagent terminates
 * we close the server socket here.
 */
InputMqttBroker.prototype.stop = function (cb) {
  this.server.close(cb)
}

InputMqttBroker.prototype.createServer = function () {
  var self = this
  if (!this.config.port) {
    this.config.port = 1883
  }
  var server = new mosca.Server({
    port: this.config.port,
    backend: this.config.backend
  })
  this.server = server
  server.on('published', function (packet, client) {
    // ignore messages e.g. from 'internal' $SYS topic (e.g. client connect/disconnect)
    if (packet.topic && ignoreTopicRegEx.test(packet.topic)) {
      return
    }
    var context = {
      name: 'input.mqtt',
      port: self.config.port,
      sourceName: packet.topic,
      topic: packet.topic,
      qos: packet.qos,
      retain: packet.retain
    }
    if (packet.payload) {
      self.eventEmitter.emit('data.raw', packet.payload.toString(), context)
    }
    if (self.config.debug === true) {
      consoleLogger.log('Published:' + JSON.stringify(packet))
    }
  })
  this.server.on('error', function (error) {
    consoleLogger.error('MQTT server error: ' + error)
  })
  this.server.on('ready', function () {
    consoleLogger.log('MQTT broker listening on port ' + self.config.port)
  })
  // fired when a client connects
  server.on('clientConnected', function (client) {
    consoleLogger.log('Client connected: ' + client.id)
  })
  // fired when a client disconnects
  server.on('clientDisconnected', function (client) {
    consoleLogger.log('Client disconnected: ' + client.id)
  })
  this.started = true
}
