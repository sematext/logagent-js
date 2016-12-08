'use strict'
var split = require('split2')
function InputCommand (config, eventEmitter) {
  this.config = config // config.configFile.input.command
  this.eventEmitter = eventEmitter
  this.started = false
}

InputCommand.prototype.start = function () {
  if (!this.started) {
    this.started = true
    this.runCommand(this.config.command, {source: this.config.sourceName || this.config.command})
  }
}

InputCommand.prototype.stop = function () {
  if (this.started) {
    this.started = false
  }
}
InputCommand.prototype.runCommand = function (cmd, context) {
  var self = this
  var exec = require('child_process').exec
  var child = exec(cmd)
  child.stdout.pipe(split()).on('data', function (data) {
    if (self.config.debug) {
      console.log('stdout: ' + data)
    }
    self.eventEmitter.emit('data.raw', data, context)
  })

  child.stderr.pipe(split()).on('data', function (data) {
    if (self.config.debug) {
      console.log('stderr: ' + data)
    }
    if (self.config.stderr) {
      self.eventEmitter.emit('data.raw', data, context)
    }
  })

  child.on('close', function (code) {
    if (self.config.debug) {
      console.log('exitCode: ' + code)
    }
    if (self.started && self.config.restart > -1) {
      setTimeout(function rc () {
        self.runCommand(cmd, context)
      }, self.config.restart * 1000)
    }
  })
}
// new InputCommand({command: 'docker ps', restart: 1}).start()
module.exports = InputCommand
