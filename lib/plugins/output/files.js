'use strict'
var format = require('string-template')
var prettyjson = require('prettyjson')
var safeStringify = require('fast-safe-stringify')
var rfs = require('rotating-file-stream')

function OutputFile (config, eventEmitter) {
  /**
   config format example:
    output:
      files:
          module: file-output
          format: template #  or ldjson, pretty, yaml
          template: '{fieldA} {fieldB}'
          sourceName: .*
          filename: /tmp/${fieldName}.txt
          size: 10M
          maxFiles: 2
          interval: 1d
          compress: true
  */
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
}

OutputFile.prototype.createStream = function (file) {
  var stream = rfs(file, {
    size: this.config.size || '10M', // rotate every 10 MegaBytes written
    interval: this.config.interval || '1d', // rotate daily
    compress: this.config.compress || true // compress rotated files
  })
  return stream
}

OutputFile.prototype.eventHandler = function (data, context) {
  if (this.sourceNameFilter.test(context.sourceName) && this.typeFilter.test(data._type)) {
    var fileName = format(this.config.fileName, data)
    if (!this.streams[fileName]) {
      this.streams[fileName] = this.createStream(fileName)
    }
    var stream = this.streams[fileName]
    if (this.config.pretty) {
      stream.write(JSON.stringify(data, null, '\t'))
    } else if (this.config.yaml) {
      stream.write(prettyjson.render(data, {noColor: false}) + '\n')
    } else if (this.config.formatTemplate) {
      stream.write(format(this.config.template, data) + '\n')
    } else {
      stream.write(safeStringify(data) + '\n')
    }
  }
  if (this.config.suppress) {
    return
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
