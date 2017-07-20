var async = require('async');
var ConsumerGroup = require('kafka-node').ConsumerGroup;

var consumerOptions = {
  kafkaHost: 'localhost:9092',
  groupId: 'ExampleTestGroup',
  sessionTimeout: 15000,
  protocol: ['roundrobin'],
  fromOffset: 'earliest'
};

var topics = ['test'];

var consumerGroup = new ConsumerGroup(Object.assign({id: 'logagent-consumer-example'}, consumerOptions), topics);
consumerGroup.on('error', onError);
consumerGroup.on('message', onMessage);

function onError (error) {
  console.error(error);
  console.error(error.stack);
}

function onMessage (message) {
  console.log('%s read msg %s Topic="%s" Partition=%s Offset=%d', this.client.clientId,message.value, message.topic, message.partition, message.offset);
}

process.once('SIGINT', function () {
  async.each([consumerGroup], function (consumer, callback) {
    consumer.close(true, callback);
  });
});