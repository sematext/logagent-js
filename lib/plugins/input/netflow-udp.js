'use strict'
var safeStringify = require('fast-safe-stringify')
const Collector = require('node-netflowv9');

/**
 * Constructor called by logagent, when the config file contains tis entry:
 * input
 *  udp:
 *    module: netflow-udp
 *    port: 7570
 *    bindAddress: 0.0.0.0
 *
 * @config cli arguments and config entries
 * @eventEmitter logent eventEmitter object
 */
function InputNetflow(config, eventEmitter) {
  this.config = config;
  this.eventEmitter = eventEmitter;
};

module.exports = InputNetflow;
/**
 * Plugin start function, called after constructor
 *
 */
InputNetflow.prototype.start = function () {
  if (!this.started) {
    this.createServer();
    this.started = true;
  };
}
/**
 * Plugin stop function, called when logagent terminates
 * we close the server socket here.
 */
InputNetflow.prototype.stop = function (cb) {
  this.socket.server.close(cb)
}

InputNetflow.prototype.createServer = function () {
  const self = this;
  this.socket = Collector({
    port: self.config.port,
    host: self.config.host
  });
  
  this.socket.on('data', function (data) {
    if (!data.flows.isOption) {
        // Return the whole flow section of each netflow packet
      data.flows.forEach(function (item) {
        const context = {
          name: 'input.netflow',
          sourceName: self.config.sourceName || data.rinfo.address + ':' + data.rinfo.port,
          serverPort: self.config.port
        }
        self.eventEmitter.emit('data.raw', safeStringify(item), context);
      })
    }
  })
}
