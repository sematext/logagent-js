'use strict'
var elasticsearch = require('elasticsearch')
/**

Config File format:

output:
  module: output-aws-elasticsearch
  host: https://my-url.es.amazonaws.com
  index: indexName
  type: typeName
  auth: 'user:password'
  awsConfig:
    # aws config entries here ... ? please complte required properties
    region: ...
*/

function OutputAwsElasticsearch (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.client = new elasticsearch.Client({
    host: config.url,
    auth: config.auth,
    connectionClass: config.awsCredentials ? require('http-aws-es') : undefined,
    awsConfig: config.awsCredentials
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
      this.eventEmitter.emit('insertError', err)
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
