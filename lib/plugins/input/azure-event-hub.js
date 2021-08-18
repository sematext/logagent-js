'use strict'
const { EventHubConsumerClient, latestEventPosition } = require('@azure/event-hubs')
const consoleLogger = require('../../util/logger.js')
/**
 *
 * config example:
 *   module: azure-event-hub
 *   name: hub1
 *   endpoint: Endpoint=sb://sematextevents.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=oahU9gjxqXvIpvJbOOU/UiTI+cyTY1kKqib43jMXnMQ=
 *   consumerGroup: '$Default'
 *   bodyField: body
 *
 **/
function InputAzureEventhub (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (!this.config.bodyField) {
    this.config.bodyField = 'body'
  }
  if (!this.config.consumerGroup) {
    this.config.consumerGroup = '$Default'
  }
  this.client = new EventHubConsumerClient(
    this.config.consumerGroup || '$Default',
    config.endpoint,
    config.name
  )
}

InputAzureEventhub.prototype.start = function () {
  this.startAsync.bind(this)()
}

InputAzureEventhub.prototype.startAsync = async function () {
  var context = {
    name: 'input.azure.eventhub',
    sourceName:
      this.config.sourceName || this.config.name || 'input.azure.eventhub',
    consumerGroup: this.config.consumerGroup || '$Default'
  }
  var eventEmitter = this.eventEmitter
  const self = this
  async function handleEvents (events, eventContext) {
    for (var i = 0; i < events.length; i++) {
      self.lastOffset = events[i].offset
      var msg = {
        // eventContext: eventContext
      }
      if (events[i].enqueuedTimeUtc) {
        msg['@timestamp'] = events[i].enqueuedTimeUtc
      }
      msg[self.config.bodyField] = events[i].body
      if (events[i].body && events[i].body.records) {
        for (var k = 0; k < events[i].body.records.length; k++) {
          var tmp = events[i].body.records[k]
          tmp['@timestamp'] = events[i].enqueuedTimeUtc
          eventEmitter.emit('data.object', tmp, context)
        }
      } else {
        eventEmitter.emit('data.object', msg, context)
      }
    }
  }
  const partitionIds = await this.client.getPartitionIds()
  this.subscriptions = []
  const subscriberHandlers = {
    processEvents: handleEvents,
    processError: async err => {
      consoleLogger.error('Azure Error: ' + err)
    }
  }
  const subscriberOptions = {
    eventPosition: latestEventPosition
  }
  for (var p = 0; p < partitionIds.length; p++) {
    this.subscriptions.push(
      this.client.subscribe(
        partitionIds[p],
        subscriberHandlers,
        subscriberOptions
      )
    )
  }
}

InputAzureEventhub.prototype.stop = function (cb) {
  this.stopAsync()
}

InputAzureEventhub.prototype.stopAsync = async function (cb) {
  if (this.subscriptions) {
    this.subscriptions.forEach(async function (sub) {
      await sub.close()
    })
  }
  if (cb) {
    cb()
  }
}

module.exports = InputAzureEventhub
