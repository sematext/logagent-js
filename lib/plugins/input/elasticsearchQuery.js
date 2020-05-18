'use strict'
var elasticsearch = require('elasticsearch')
var AWS = require('aws-sdk')

/**
 * Constructor called by logagent
 * @config cli arguments and config entries
 * @eventEmitter logent eventEmitter object
 */
function InputElasticsearchQuery (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}
module.exports = InputElasticsearchQuery
/**
 * Plugin start function, called after constructor
 *
 */
InputElasticsearchQuery.prototype.start = function () {
  if (!this.started) {
    this.started = true
    var self = this
    var runQuery = function () {
      self.query()
    }
    if (this.config.interval && this.config.interval > 0) {
      this.tid = setInterval(runQuery, this.config.interval * 1000)
    }
    runQuery()
  }
}

/**
 * Plugin stop function, called when logagent terminates
 * we close the server socket here.
 */
InputElasticsearchQuery.prototype.stop = function (cb) {
  if (this.config.tid) {
    clearInterval(this.tid)
  }
}

InputElasticsearchQuery.prototype.query = function () {
  var self = this
  var config = self.config
  var client = null
  var clientCfg = {
    host: self.config.url,
    log: self.config.log
  }
  var auth = config.auth
  var awsConfigFile = config.awsConfigFile
  if (config.awsEnabled) {
    if (!config.auth && config.configFile.aws && config.configFile.aws.auth) {
      auth = config.configFile.aws.auth
    }
    if (
      !config.awsConfigFile &&
      config.configFile.aws &&
      config.configFile.aws.awsConfigFile
    ) {
      awsConfigFile = config.configFile.aws.awsConfigFile
    }
    clientCfg.auth = auth
    clientCfg.connectionClass = config.awsConfigFile
      ? require('http-aws-es')
      : undefined
    clientCfg.awsConfig = AWS.config.loadFromPath(awsConfigFile)
  }
  client = new elasticsearch.Client(clientCfg)
  if (self.config.query.index) {
    var now = new Date()
    self.config.query.index = self.config.query.index.replace(
      /YYYY|MM|DD/g,
      function (match) {
        if (match === 'YYYY') {
          return '' + now.getFullYear()
        }
        if (match === 'MM') {
          return ('0' + (now.getMonth() + 1)).substr(-2)
        }
        if (match === 'DD') {
          return ('0' + now.getDate()).substr(-2)
        }
        return match
      }
    )
  }
  client
    .search(self.config.query)
    .then(
      function (body) {
        if (!body.hits) {
          return
        }
        var hits = body.hits.hits
        if (hits) {
          var context = {
            name: 'input.elasticsearch.query',
            sourceName: self.config.sourceName || 'input.elasticsearch.query'
          }
          hits.forEach(function (result) {
            var data = result
            if (data._source) {
              data = result._source
              data._id = result._id
              data._type = result._type
            }
            self.eventEmitter.emit('data.object', data, context)
          })
        }
      },
      function (error) {
        console.trace(error.message)
      }
    )
    .catch(console.trace)
}
