'use strict'
var elasticsearch = require('elasticsearch')
const AWS = require('aws-sdk')
/**

Config File format:

output:
  module: output-aws-elasticsearch
  url: https://my-url.es.amazonaws.com
  index: indexName
  type: typeName
  auth: 'user:password'
  awsConfigFile: ./aws-config.json
*/

function OutputAwsElasticsearch (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.client = new elasticsearch.Client({
    host: config.url,
    auth: config.auth,
    connectionClass: config.awsConfigFile ? require('http-aws-es') : undefined,
    awsConfig: AWS.config.loadFromPath(config.awsConfigFile)
  })
}

OutputAwsElasticsearch.prototype.eventHandler = function (data, context) {
  var obj = {
    index: this.config.index,
    type: this.config.type,
    body: data
  }
  this.client.index(obj, function (err, data) {
    if (!err) {
      this.eventEmitter.emit('aws-insert', data)
    } else {
      this.eventEmitter.emit('aws-insert-error', err, data)
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
