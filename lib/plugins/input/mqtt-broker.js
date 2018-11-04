"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net = require("net");
const http = require("http");
const Aedes = require("aedes");
const ws = require("websocket-stream");
const consoleLogger = require("../../util/logger.js");
var ignoreTopicRegEx = /^\$SYS/;
class InputMqttBroker {
    constructor(config, eventEmitter) {
        this.config = null;
        this.eventEmitter = null;
        this.aedes = null;
        this.started = false;
        this.server = null;
        this.httpServer = null;
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.aedes = new Aedes();
    }
    start() {
        if (!this.started) {
            this.createServer();
            this.started = true;
        }
        try {
            if (this.config.ignoreTopic) {
                ignoreTopicRegEx = new RegExp(this.config.ignoreTopic);
            }
        }
        catch (error) {
            consoleLogger.error('MQTT config property ignoreTopic is not a Regular Expression:' + error);
        }
    }
    stop(cb) {
        this.server.close(cb);
    }
    createServer() {
        var self = this;
        var config = this.config;
        var aedes = this.aedes;
        if (!this.config.port) {
            this.config.port = 1883;
        }
        this.server = net.createServer(this.aedes.handle);
        this.server.listen(this.config.port, function () {
            consoleLogger.log('MQTT server listening on port ' + self.config.port);
        });
        if (this.config.websocketPort) {
            this.httpServer = http.createServer();
            ws.createServer({
                server: self.httpServer
            }, this.aedes.handle);
            this.httpServer.listen(this.config.websocketPort, function () {
                consoleLogger.log('MQTT websocket server listening on port ' + self.config.websocketPort);
            });
        }
        aedes.on('clientError', function (client, err) {
            consoleLogger.error('MQTT client error ' + client.id + ': ' + err.message);
        });
        aedes.on('publish', function (packet, client) {
            if (packet.topic && ignoreTopicRegEx.test(packet.topic)) {
                return;
            }
            var context = {
                name: 'input.mqtt',
                port: self.config.port,
                sourceName: packet.topic,
                topic: packet.topic,
                qos: packet.qos,
                retain: packet.retain
            };
            if (packet.payload) {
                self.eventEmitter.emit('data.raw', packet.payload.toString(), context);
            }
            if (self.config.debug === true) {
                consoleLogger.log('Published:' + JSON.stringify(packet));
            }
        });
        aedes.on('subscribe', function (subscriptions, client) {
            if (client && config.debug) {
                consoleLogger.error('MQTT subscribe from client ' + client.id + ': ' + subscriptions);
            }
        });
        aedes.on('client', function (client) {
            if (config.debug) {
                consoleLogger.log('Client connected: ' + client.id);
            }
        });
        aedes.on('clientDisconnected', function (client) {
            if (config.debug) {
                consoleLogger.log('Client disconnected: ' + client.id);
            }
        });
        this.started = true;
    }
}
exports.default = InputMqttBroker;
