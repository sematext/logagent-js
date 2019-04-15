// Emit k8s events as Node.js events
const Client = require('kubernetes-client').Client
const config = require('kubernetes-client').config
const JSONStream = require('json-stream')
var consoleLogger = require('../../util/logger.js')
var EventEmitter = require('events').EventEmitter

class KubernetesEventEmitter extends EventEmitter {
  constructor () {
    super()
    // do we run in k8s cluster?
    if (process.env.KUBERNETES_PORT_443_TCP !== undefined) {
      this.client = new Client({ config: config.getInCluster() })
    } else {
      this.client = new Client({ config: config.fromKubeconfig() })
    }
    this.client.loadSpec().then(this.start.bind(this)).catch(error => {
      console.error(error)
    })
  }

  startWatching () {
    var self = this
    // API docs: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#list-all-namespaces-event-v1-core
    self.stream = self.client.api.v1.events.getStream()
    self.jsonStream = new JSONStream()
    self.stream.pipe(this.jsonStream)
    self.jsonStream.on('data', object => {
      for (var i = 0; i < object.items.length; i++) {
        self.emit('event', object.items[i])
      }
    })
    self.stream.on('error', function (err) {
      self.emit('error', err)
      self.stop()
      self.startWatching()
    })
  }

  start () {
    try {
      this.startWatching()
    } catch (err) {
      this.emitter.emit('error', err)
      consoleLogger.error('KubernetesEvents error: ' + err)
    }
  }

  stop () {
    try {
      this.stream.abort()
    } catch (err) {
      this.emit('error', err)
    }
  }
}

function KubernetesEvents (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}

KubernetesEvents.prototype.stop = function (cb) {
  this.k8s.stop()
  cb()
}

KubernetesEvents.prototype.addTags = function (log) {
  if (this.config.tags === undefined) {
    return
  }
  var keys = Object.keys(this.config.tags)
  for (var i = 0; i < keys.length; i++) {
    log[keys[i]] = this.config.tags[keys[i]]
  }
}

KubernetesEvents.prototype.start = function () {
  var context = {name: 'k8s', sourceName: this.config.sourceName || 'k8s'}
  var self = this
  this.k8s = new KubernetesEventEmitter()
  this.k8s.on('event', function (event) {
    self.addTags(event)
    event['@timestamp'] = event.firstTimestamp
    self.eventEmitter.emit('data.parsed', event, context)
  })
  this.k8s.on('error', function (error) {
    consoleLogger.error('Error in k8s event collector:' + error.message + ' ' + error.stack)
  })
}

module.exports = KubernetesEvents
