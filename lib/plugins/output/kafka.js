'use strict'

var consoleLogger = require('../../util/logger.js')
var kafka = require('kafka-node')
var HighLevelProducer = kafka.HighLevelProducer;
var kafkaClient = kafka.Client;
var client = new kafkaClient();
var producer = new HighLevelProducer(client);

function OutputKafka (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}

OutputKafka.prototype.getProducer = function ()
{
    var instance


    return instance;

}



// event publish data
OutputKafka.prototype.eventHandler = function (data, context) {
  if (this.config.suppress) {
    return
  }
  if (this.config.pretty) {
    console.log(JSON.stringify(data, null, '\t'))
  } else if (this.config.yaml) {
    console.log(prettyjson.render(data, {noColor: false}) + '\n')
  } else {
    console.log(safeStringify(data))
  }
}

OutputKafka.prototype.start = function () {
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

OutputKafka.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = OutputKafka
