'use strict'
var split = require('split2')
var net = require('net')
var consoleLogger = require('../../util/logger.js')

/**
 * Constructor called by logagent, when the config file contains the following entry:
 * input
 *  suricata-socket:
 *    module: input-unix-socket-client
 *    path: /var/log/suricata/eve.socket
 *    # max input rate in megabyte/s
 *    maxInputRateMBs: 1
 *
 * @config cli arguments and config entries
 * @eventEmitter logent eventEmitter object
 */
function UnixSocketReader (config, eventEmitter) {
  this.config = config
  this.config.maxInputRate = (config.maxInputRateMBs || 100) * 1024 * 1024
  this.eventEmitter = eventEmitter
}

module.exports = UnixSocketReader

/**
 * Plugin start function, called after constructor
 */
UnixSocketReader.prototype.start = function () {
  const self = this
  function errorHandler (error) {
    if (error) {
      consoleLogger.error(
        `Error connectiong to ${self.config.path}: ${error.message}`
      )
    }
  }
  const context = { sourceName: self.config.path }
  if (!this.started) {
    this.client = net.createConnection(this.config.path, errorHandler)
    this.client.on('error', errorHandler)
    this.client.on('connect', function (err) {
      if (!err) {
        consoleLogger.log(`connected to ${self.config.path}`)
        self.client
          .pipe(Throttle(self.config.maxInputRate))
          .pipe(split())
          .on('data', function emitLine (data) {
            // emit a 'data.raw' event for each line we receive
            self.eventEmitter.emit('data.raw', data, context)
            if (self.config.debug) {
              consoleLogger.debug(data + '\n', context)
            }
          })
      } else {
        consoleLogger.error(
          `Error connectiong to ${self.config.path}: ${err.message}`
        )
      }
    })
    this.started = true
  }
}

/**
 * Plugin stop function, called when logagent terminates
 * we close the server socket here.
 */
UnixSocketReader.prototype.stop = function (cb) {
  this.client.end()
  if (cb) {
    cb()
  }
}

// helper  to throttle bandwidth
var StreamThrottle = require('stream-throttle').Throttle
function Throttle (maxRate) {
  var inputRate = maxRate || 1024 * 1024 * 100
  var chunkSize = inputRate / 10
  if (chunkSize < 1) {
    chunkSize = 1
  }
  return new StreamThrottle({
    chunksize: chunkSize,
    rate: inputRate || 1024 * 1024 * 100
  })
}
