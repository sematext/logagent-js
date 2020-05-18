'use strict'
var Aedes = require('aedes')
var ws = require('websocket-stream')
var consoleLogger = require('../../util/logger.js')
var ignoreTopicRegEx = /^\$SYS/
/**
 * Constructor called by logagent, when the config file contains this entry:
 * input:
 *  mqtt-broker:
 *    module: mqtt-broker
 *    port: 1883
 *    websocketPort: 9883
 *    ignoreTopic: ^\$SYS
 *    debug: false
 *    username: mqtt
 *    password: secret
 *
 * @config cli arguments and config entries
 * @eventEmitter logent eventEmitter object
 */
function InputMqttBroker (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.aedes = new Aedes()
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
      ignoreTopicRegEx = new RegExp(this.config.ignoreTopic)
    }
  } catch (error) {
    consoleLogger.error(
      'MQTT config property ignoreTopic is not a Regular Expression:' + error
    )
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
  var config = this.config
  var aedes = this.aedes
  if (!this.config.port) {
    this.config.port = 1883
  }
  if (this.config.username && this.config.password) {
    consoleLogger.log('MQTT authentication is enabled via username/password')
    this.aedes.authenticate = function (client, username, password, callback) {
      callback(
        null,
        username === self.config.username && password === self.config.password
      )
    }
  } else if (
    this.config.authenticate &&
    typeof this.config.authenticate === 'function'
  ) {
    consoleLogger.log(
      'MQTT authentication is enabled via authenticate function'
    )
    this.aedes.authenticate = this.config.authenticate
  }
  this.server = require('net').createServer(this.aedes.handle)
  this.server.listen(this.config.port, function () {
    consoleLogger.log('MQTT server listening on port ' + self.config.port)
  })
  if (this.config.websocketPort) {
    this.httpServer = require('http').createServer()
    ws.createServer(
      {
        server: self.httpServer
      },
      this.aedes.handle
    )
    this.httpServer.listen(this.config.websocketPort, function () {
      consoleLogger.log(
        'MQTT websocket server listening on port ' + self.config.websocketPort
      )
    })
  }
  aedes.on('clientError', function (client, err) {
    consoleLogger.error('MQTT client error ' + client.id + ': ' + err.message)
  })

  aedes.on('publish', function (packet, client) {
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

  aedes.on('subscribe', function (subscriptions, client) {
    if (client && config.debug) {
      consoleLogger.error(
        'MQTT subscribe from client ' + client.id + ': ' + subscriptions
      )
    }
  })
  // fired when a client connects
  aedes.on('client', function (client) {
    if (config.debug) {
      consoleLogger.log('Client connected: ' + client.id)
    }
  })
  // fired when a client disconnects
  aedes.on('clientDisconnected', function (client) {
    if (config.debug) {
      consoleLogger.log('Client disconnected: ' + client.id)
    }
  })
  this.started = true
}
