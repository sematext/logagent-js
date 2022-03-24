'use strict'
const split = require('split2')
const moment = require('moment')
const logger = require('../../util/logger.js')
const fs = require('graceful-fs')
const os = require('os')
const path = require('path')

function InputCommand (config, eventEmitter) {
  this.config = config // config.configFile.input.command
  this.eventEmitter = eventEmitter
  this.started = false
  this.lastRun = new Date()
}

InputCommand.prototype.start = function () {
  if (!this.started) {
    this.started = true
    const dateFormat = this.config.dateFormat
    if (/\$QUERY_TIME/.test(this.config.command)) {
      this.config.QUERY_TIME = true
      this.lastQueryTimeFile =
        this.config.lastQueryTimeFile ||
        path.join(os.tmpdir(), 'logagentLastQueryTimeFile')
      // by default, query this century
      const defaultLastRun =
        this.config.initialQueryTime || '2001-01-01T00:00:00'
      this.lastRun = moment(defaultLastRun, moment.ISO_8601).format(dateFormat)
      try {
        this.lastRun = moment(
          fs.readFileSync(this.lastQueryTimeFile),
          dateFormat
        )
      } catch (err) {
        logger.warn(
          'Error while getting the date from' +
            this.lastQueryTimeFile +
            '. Using ' +
            moment(this.lastRun).format(dateFormat) +
            ". We'll try to create that file on each query. Error was: " +
            err
        )
      }
    }
    // default buffer for the command pipe is 50MB
    const maxBuffer = this.config.maxBuffer || 50000000
    this.runCommand(
      this.config.command,
      {
        sourceName: this.config.sourceName || this.config.command
      },
      dateFormat,
      maxBuffer
    )
  }
}

InputCommand.prototype.stop = function () {
  if (this.started) {
    this.started = false
  }
}
InputCommand.prototype.runCommand = function (
  cmd,
  context,
  dateFormat,
  maxBuffer
) {
  const self = this
  const exec = require('child_process').exec
  let cmdTemplate = cmd.replace(/\$NOW/g, moment().format(dateFormat))
  if (this.config.QUERY_TIME) {
    cmdTemplate = cmdTemplate.replace(
      /\$QUERY_TIME/g,
      moment(self.lastRun).format(dateFormat)
    )
  }

  logger.debug(cmdTemplate)
  const child = exec(cmdTemplate, { maxBuffer: maxBuffer })
  self.lastRun = new Date()

  child.stdout.pipe(split()).on('data', function (data) {
    logger.debug('stdout: ' + data)
    self.eventEmitter.emit('data.raw', data, context)
  })

  child.stderr.pipe(split()).on('data', function (data) {
    logger.debug('stderr: ' + data)
    if (self.config.stderr) {
      self.eventEmitter.emit('data.raw', data, context)
    }
  })

  child.on('close', function (code) {
    logger.debug('exitCode: ' + code)
    if (self.started && self.config.restart > -1) {
      setTimeout(function rc () {
        self.runCommand(cmd, context, dateFormat, maxBuffer)
      }, self.config.restart * 1000)
    }
  })

  if (this.config.QUERY_TIME) {
    try {
      fs.writeFileSync(
        this.lastQueryTimeFile,
        moment(self.lastRun).format(dateFormat)
      )
    } catch (err) {
      logger.error('error writing last run time:' + err)
    }
  }
}
// new InputCommand({command: 'docker ps', restart: 1}).start()
module.exports = InputCommand
