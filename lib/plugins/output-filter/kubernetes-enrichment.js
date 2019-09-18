const { KubeConfig } = require('kubernetes-client')
const Client = require('kubernetes-client').Client
const Request = require('kubernetes-client/backends/request')

const kubeconfig = new KubeConfig()
var consoleLogger = require('../../util/logger.js')
var LRU = require('lru-cache')
var podCache = new LRU({
  max: 2000,
  maxAge: 1000 * 60 * 60
})

var digestRegEx = /sha256:.+/i
var client = null
const FALSE_REGEX = /false/i

if (process.env.KUBERNETES_PORT_443_TCP !== undefined) {
  kubeconfig.loadFromCluster()
} else {
  kubeconfig.loadFromDefault()
}
client = new Client({ backend: new Request({ kubeconfig }) })
client.loadSpec().catch(error => {
  consoleLogger.error('Error in k8s client', error)
})

function kubernetesOutputFilter (context, config, eventEmitter, data, callback) {
  // we use the config object to track state of each plugin instance
  if (!config.client) {
    initKubernetesClient(config)
  } else {
    enrichLogs(context, config, eventEmitter, data, callback)
  }
}

function initKubernetesClient (config) {
  // do we run in k8s cluster?
  config.client = client
  config.getPodSpec = function (namespace, podName, cb) {
    this.client.api.v1.namespaces(namespace).pods(podName).get(cb)
  }.bind(config)
}

async function getPodSpec (config, namespace, podName, cb) {
  if (config.client && config.client.api) {
    var spec = await config.client.api.v1.namespaces(namespace).pods(podName).get()
    cb(null, spec.body)
  } else {
    cb(new Error('Kuberntes API not ready'))
  }
}

function removeFields (pod, data) {
  if (pod && pod.stRemoveFields === false) {
    return
  }
  var annotations = pod.metadata.annotations
  if (!annotations) {
    pod.stRemoveFields = false
    return
  }
  var removeFields = annotations['REMOVE_FIELDS'] || annotations['sematext.com/logs-remove-fields']
  if (removeFields) {
    var fieldNames = removeFields.split(',')
    for (var i = 0; i < fieldNames.length; i++) {
      delete data[fieldNames[i]]
    }
  } else {
    pod.stRemoveFields = false
  }
}

function checkLogsEnabled (pod, data, context) {
  if (pod.stLogEnabled === false) {
    data.stLogEnabled = false
    return
  }
  var annotations = pod.metadata.annotations
  if (annotations) {
    var logsEnabled = annotations['sematext.com/logs-enabled']
    if (FALSE_REGEX.test(logsEnabled)) {
      data.stLogEnabled = false
      pod.stLogEnabled = false
      if (process.env.DEBUG) {
        consoleLogger.error('stLogEnabled = false - ' + pod.metadata.name)
      }
    } else {
      pod.stLogEnabled = true
    }
  }
}

function addLogsIndex (pod, data) {
  if (pod.stLogsTokenSet === false) {
    return
  }
  if (!pod.metadata.annotations) {
    pod.stLogsTokenSet = false
    return
  }
  // get ST Logs Token from pod annotation
  var index = pod.metadata.annotations['sematext.com/logs-token']
  // get comma separated list of fields from pod annotation
  if (index) {
    data._index = index
  } else {
    pod.stLogsTokenSet = false
  }
}

function replaceDockerImageName (pod, data) {
  if (data.kubernetes && data.container && pod.stImageCache) {
    var containerName = data.kubernetes.pod.container.name
    var imageInfo = pod.stImageCache[data.kubernetes.pod.name + containerName]
    if (!imageInfo) {
      return
    }
    if (data.container.image.name === 'sha256') {
      data.container.image.digest = 'sha256:' + data.container.image.tag
    }
    data.container.image.name = imageInfo.name
    data.container.image.tag = imageInfo.tag
  } else {
    pod.stLogsTokenSet = false
  }
}

function processAnnotations (data, context) {
  var pod = podCache.get(data.kubernetes.namespace + '/' + data.kubernetes.pod.name)
  if (pod && pod.metadata) {
    checkLogsEnabled(pod, data, context)
    if (data.stLogEnabled === false) {
      // logs will be droped, so no need for other processing
      return
    }
    replaceDockerImageName(pod, data)
    removeFields(pod, data)
    addLogsIndex(pod, data)
  }
}

function enrichLogs (context, config, eventEmitter, data, callback) {
  if (!(data.kubernetes && data.kubernetes.pod)) {
    return callback(null, data)
  }

  if (podCache.get(data.kubernetes.namespace + '/' + data.kubernetes.pod.name)) {
    processAnnotations(data, context)
    if (data.stLogEnabled === false) {
      // allow input plugins to close the input stream, e.g. input/docker/docker.js
      eventEmitter.emit('dropLogsRequest', context, data)
      if (config.debug === true) {
        consoleLogger.log('logs dropped ' + data.kubernetes.namespace + '/' + data.kubernetes.pod.name, data.message)
      }
      return callback()
    } else {
      return callback(null, data)
    }
  } else {
    getPodSpec(
      config,
      data.kubernetes.namespace,
      data.kubernetes.pod.name,
      function (err, pod) {
        if (err) {
          consoleLogger.log(err.message)
          return callback(null, data)
        }
        podCache.set(data.kubernetes.namespace + '/' + data.kubernetes.pod.name, pod)
        // create hashtable with containerName -> imageInformation
        pod.stImageCache = {}
        if (pod.spec && pod.spec.containers) {
          var podContainers = pod.spec.containers
          for (var i = 0; i < podContainers.length; i++) {
            var container = podContainers[i]
            // split imageName:version
            var imageInfo = container.image.split(':')
            // split registry/imageName
            var imageRegistryInfo = container.image.split('/')
            var imageKey = pod.metadata.name + container.name
            pod.stImageCache[imageKey] = {
              image: container.image,
              name: imageInfo[0],
              registry: imageRegistryInfo[0]
            }
            if (imageInfo.length > 1) {
              pod.stImageCache[imageKey].tag = imageInfo[1]
            }
            if (imageRegistryInfo.length > 1) {
              pod.stImageCache[imageKey].plainImageName = imageRegistryInfo[1]
            }
          }
        }
        if (config.debug) {
          consoleLogger.log('pod spec: ' + JSON.stringify(pod, null, ' '))
        }
        processAnnotations(data, context)
        if (data.stLogEnabled === false) {
          // allow input plugins to close the input stream, e.g. input/docker/docker.js
          eventEmitter.emit('dropLogsRequest', context, data)
          return callback()
        } else {
          return callback(null, data)
        }
      }
    )
  }
}

module.exports = kubernetesOutputFilter
