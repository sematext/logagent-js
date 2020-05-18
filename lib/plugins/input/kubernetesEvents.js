// Emit k8s events as Node.js events
const { KubeConfig } = require('kubernetes-client')
const Client = require('kubernetes-client').Client
const Request = require('kubernetes-client/backends/request')
const consoleLogger = require('../../util/logger.js')
const EventEmitter = require('events').EventEmitter

class KubernetesEventEmitter extends EventEmitter {
  constructor () {
    super()
    const kubeconfig = new KubeConfig()
    // do we run in k8s cluster?
    if (process.env.KUBERNETES_PORT_443_TCP !== undefined) {
      kubeconfig.loadFromCluster()
    } else {
      kubeconfig.loadFromDefault()
    }
    this.client = new Client({ backend: new Request({ kubeconfig }) })
    this.client
      .loadSpec()
      .then(this.start.bind(this))
      .catch(error => {
        console.error('Error in k8s client', error)
      })
  }

  async startWatching (namespace, cb) {
    var self = this
    // API docs: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#list-all-namespaces-event-v1-core
    // https://github.com/godaddy/kubernetes-client/blob/master/merging-with-kubernetes.md#getstream
    self[namespace] = await this.client.api.v1.watch
      .namespaces(namespace)
      .pods.getObjectStream()
    self[namespace].on('data', object => {
      self.emit('event', object)
    })
    self[namespace].on('error', function (err) {
      self.emit('error', err)
      self.stop()
      self.startWatching(namespace, cb)
    })
    cb()
  }

  async startWatchingAllNamespaces (callback) {
    const namespaces = await this.client.api.v1.namespaces.get()
    for (var i = 0; i < namespaces.length; i++) {
      this.startWatching(namespaces[i], callback)
    }
    callback()
  }

  start (cb) {
    try {
      this.startWatchingAllNamespaces(() => {})
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
  var context = { name: 'k8s', sourceName: this.config.sourceName || 'k8s' }
  var self = this
  this.k8s = new KubernetesEventEmitter()
  this.k8s.on('event', function (event) {
    self.addTags(event)
    event['@timestamp'] = event.firstTimestamp
    self.eventEmitter.emit('data.object', event, context)
  })
  this.k8s.on('error', function (error) {
    consoleLogger.error(
      'Error in k8s event collector:' + error.message + ' ' + error.stack
    )
  })
}

module.exports = KubernetesEvents
