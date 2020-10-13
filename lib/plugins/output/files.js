'use strict'
const format = require('string-template')
const prettyjson = require('prettyjson')
const safeStringify = require('fast-safe-stringify')
const rfs = require('rotating-file-stream')

function OutputFile (config, eventEmitter) {
  this.streams = {}
  this.config = config
  this.eventEmitter = eventEmitter
  this.sourceNameFilter = new RegExp(config.sourceName || '.*')
  this.typeFilter = new RegExp(config.typeName || '.*')
  if (config.format === 'ldjson') {
    this.config.ldjson = true
  }
  if (config.format === 'yaml') {
    this.config.yaml = true
  }
  if (config.format === 'pretty') {
    this.config.pretty = true
  }
  if (config.format === 'template') {
    this.config.formatTemplate = true
  }
  if (config.compress === false) {
    this.config.compress = false
  } else {
    this.config.compress = true
  }
}

OutputFile.prototype.createStream = function (file) {
  const stream = rfs(file, {
    size: this.config.size || '10M', // rotate every 10 MegaBytes written
    interval: this.config.interval || '1d', // rotate daily
    compress: this.config.compress // compress rotated files
  })
  stream.on('error', console.log)
  stream.on('warning', console.log)

  return stream
}

OutputFile.prototype.eventHandler = function (data, context) {
  if (
    this.sourceNameFilter.test(context.sourceName) &&
    this.typeFilter.test(data._type)
  ) {
    const fileName = format(this.config.fileName, data)
    if (!this.streams[fileName]) {
      this.streams[fileName] = this.createStream(fileName)
    }
    const stream = this.streams[fileName]

    if (this.config.pretty) {
      return stream.write(JSON.stringify(data, null, '\t'))
    }

    if (this.config.yaml) {
      return stream.write(prettyjson.render(data, { noColor: false }) + '\n')
    }

    if (this.config.formatTemplate) {
      return stream.write(format(this.config.template, data) + '\n')
    }

    return stream.write(safeStringify(data) + '\n')
  }
}

OutputFile.prototype.start = function () {
  if (!this.config.fileName) {
    throw new Error('missing fileName property')
  }
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

OutputFile.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = OutputFile
