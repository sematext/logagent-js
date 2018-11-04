import * as net from 'net';
import * as http from 'http';
import * as Aedes from 'aedes';
import * as ws from 'websocket-stream';
import * as consoleLogger from '../../util/logger.js';

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
 *
 * @config cli arguments and config entries
 * @eventEmitter logent eventEmitter object
 */
class InputMqttBroker {
  config = null;
  eventEmitter = null;
  aedes = null;

  started: boolean = false;
  server: net.Server = null;
  httpServer: http.Server = null;

  constructor(config, eventEmitter) {
    this.config = config
    this.eventEmitter = eventEmitter
    this.aedes = new Aedes()
  }

  /**
   * Plugin start function, called after constructor
   *
   */
  start() {
    if (!this.started) {
      this.createServer()
      this.started = true
    }
    try {
      if (this.config.ignoreTopic) {
        ignoreTopicRegEx = new RegExp(this.config.ignoreTopic)
      }
    } catch (error) {
      consoleLogger.error('MQTT config property ignoreTopic is not a Regular Expression:' + error)
    }
  }

  /**
   * Plugin stop function, called when logagent terminates
   * we close the server socket here.
   */
  stop(cb) {
    this.server.close(cb)
  }

  createServer() {
    var self = this
    var config = this.config
    if (!this.config.port) {
      this.config.port = 1883
    }
    this.server = net.createServer(this.aedes.handle)
    this.server.listen(this.config.port, function () {
      consoleLogger.log('MQTT server listening on port ' + self.config.port)
    })
    if (this.config.websocketPort) {
      this.httpServer = http.createServer()
      ws.createServer({
        server: self.httpServer
      }, this.aedes.handle)
      this.httpServer.listen(this.config.websocketPort, function () {
        consoleLogger.log('MQTT websocket server listening on port ' + self.config.websocketPort)
      })
    }
    this.aedes.on('clientError', function (client, err) {
      consoleLogger.error('MQTT client error ' + client.id + ': ' + err.message)
    })

    this.aedes.on('publish', function (packet, client) {
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

    this.aedes.on('subscribe', function (subscriptions, client) {
      if (client && config.debug) {
        consoleLogger.error('MQTT subscribe from client ' + client.id + ': ' + subscriptions)
      }
    })
    // fired when a client connects
    this.aedes.on('client', function (client) {
      if (config.debug) {
        consoleLogger.log('Client connected: ' + client.id)
      }
    })
    // fired when a client disconnects
    this.aedes.on('clientDisconnected', function (client) {
      if (config.debug) {
        consoleLogger.log('Client disconnected: ' + client.id)
      }
    })
    this.started = true
  }

}

export default InputMqttBroker;
