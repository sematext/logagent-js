'use strict'
var elasticsearch = require('elasticsearch')
const AWS = require('aws-sdk')
var consoleLogger = require('../../util/logger.js')
/**

Config File format:
# global AWS settings
aws:
  auth: 'user:password'
  awsConfigFile: ./aws-config.json

output:
  module: output-aws-elasticsearch
  url: https://my-url.es.amazonaws.com
  index: indexName
  type: typeName
  # local AWS settings (overwrite global AWS settings)
  auth: 'user:password'
  awsConfigFile: ./aws-config.json
*/

function OutputAwsElasticsearch (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  // read global AWS settings if the plugin has no local AWS settings
  var auth = config.auth
  var awsConfigFile = config.awsConfigFile
  if (!config.auth && config.configFile.aws && config.configFile.aws.auth) {
    auth = config.configFile.aws.auth
  }
  if (!config.awsConfigFile && config.configFile.aws && config.configFile.aws.awsConfigFile) {
    awsConfigFile = config.configFile.aws.awsConfigFile
  }
  var esClientConfig = {
    log: config.log,
    host: config.url,
    auth: auth,
    connectionClass: config.awsConfigFile ? require('http-aws-es') : undefined,
    awsConfig: AWS.config.loadFromPath(awsConfigFile)
  }
  this.client = new elasticsearch.Client(esClientConfig)
}

OutputAwsElasticsearch.prototype.eventHandler = function (data, context) {
  // support for time-based index patterns
  var index = this.config.index
  index = index.replace(/YYYY|MM|DD/g, function (match) {
    if (match === 'YYYY') {
      return '' + data['@timestamp'].getFullYear()
    }
    if (match === 'MM') {
      return ('0' + (data['@timestamp'].getMonth() + 1)).substr(-2)
    }
    if (match === 'DD') {
      return ('0' + data['@timestamp'].getDate()).substr(-2)
    }
    return match
  })

  var obj = {
    index: index,
    type: this.config.type,
    body: data
  }
  var self = this
  this.client.index(obj, function (err, data) {
    if (!err) {
      self.eventEmitter.emit('aws-insert', data)
    } else {
      self.eventEmitter.emit('aws-insert-error', err, data)
      consoleLogger.error('aws-elasticsearch:' + err)
    }
  })
}

OutputAwsElasticsearch.prototype.start = function () {
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

OutputAwsElasticsearch.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = OutputAwsElasticsearch
