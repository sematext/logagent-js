const { KubeConfig } = require('kubernetes-client')
const Client = require('kubernetes-client').Client
const Request = require('kubernetes-client/backends/request')
const kubeconfig = new KubeConfig()
var consoleLogger = require('../../util/logger.js')
var podCache = {}
var digestRegEx = /sha256:.+/i
var client = null
const FASLE_REGEX = /false/i
if (process.env.KUBERNETES_PORT_443_TCP !== undefined) {
  kubeconfig.loadFromCluster()
} else {
  kubeconfig.loadFromDefault()
}
client = new Client({ backend: new Request({ kubeconfig }) })
client.loadSpec().then(() => {}).catch(error => {
  console.error('Error in k8s client', error)
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
  // clean cache after 10 minutes
  // TODO: use LRU Cache
  setInterval(() => { podCache = {} }, 10 * 60 * 1000)
}

async function getPodSpec (config, namespace, podName, cb) {
  if (config.client && config.client.api) {
    var spec = await config.client.api.v1.namespaces(namespace).pods(podName).get()
    cb(null, spec.body)
  } else {
    cb(new Error('Kuberntes API not ready'))
  }
}

function removeFields (key, data) {
  if (podCache[key].stRemoveFields === false) {
    return
  }
  var annotations = podCache[key].metadata.annotations
  var removeFields = annotations['REMOVE_FIELDS'] || annotations['sematext.com/logs-remove-fields']
  if (removeFields) {
    var fieldNames = removeFields.split(',')
    for (var i = 0; i < fieldNames.length; i++) {
      delete data[fieldNames[i]]
    }
  } else {
    podCache[key].stRemoveFields = false
  }
}

function checkLogsEnabled (key, data, context) {
  if (podCache[key].stLogEnabled === false) {
    data.stLogEnabled = false
    return
  }
  var annotations = podCache[key].metadata.annotations
  if (annotations) {
    var logsEnabled = annotations['sematext.com/logs-enabled']
    if (FALSE_REGEX.test(logsEnabled) {
      data.stLogEnabled = false
      podCache[key].stLogEnabled = false
      if (process.env.DEBUG) {
        console.error('stLogEnabled = false', key)
      }
    } else {
      podCache[key].stLogEnabled = true
    }
  }
}

function addLogsIndex (key, data) {
  if (podCache[key].stLogsTokenSet === false) {
    return
  }
  // get ST Logs Token from pod annotation
  var index = podCache[key].metadata.annotations['sematext.com/logs-token']
  // get comma separated list of fields from pod annotation
  if (index) {
    data._index = index
  } else {
    podCache[key].stLogsTokenSet = false
  }
}
/*

function updatePodUid (key, data) {
  if (data.kubernetes && podCache[key]) {
    data.kubernetes.pod.uid = podCache[key].metadata.uid
  } else {
    podCache[key].stLogsTokenSet = false
  }
}

*/

function replaceDockerImageName (key, data) {
  if (data.kubernetes && data.container && podCache[key].stImageCache) {
    var containerName = data.kubernetes.pod.container.name
    var imageInfo = podCache[key].stImageCache[data.kubernetes.pod.name + containerName]
    if (!imageInfo) {
      return
    }
    if (data.container.image.name === 'sha256') {
      data.container.image.digest = 'sha256:' + data.container.image.tag
    }
    data.container.image.name = imageInfo.name
    data.container.image.tag = imageInfo.tag
    // data.container.image.registry = imageInfo.version
    // data.container.image.name = imageInfo.plainImageName
  } else {
    podCache[key].stLogsTokenSet = false
  }
}

function processAnnotations (data, context) {
  var key = data.kubernetes.namespace + '/' + data.kubernetes.pod.name
  if (podCache[key] && podCache[key].metadata) {
    checkLogsEnabled(key, data, context)
    if (data.stLogEnabled === false) {
      // logs will be droped, so no need for other processing
      return
    }
    // updatePodUid (key, data)
    replaceDockerImageName(key, data)
    removeFields(key, data)
    addLogsIndex(key, data)
  }
}

function enrichLogs (context, config, eventEmitter, data, callback) {
  if (data.kubernetes && data.kubernetes.pod) {
    if (podCache[data.kubernetes.namespace + '/' + data.kubernetes.pod.name]) {
      processAnnotations(data, context)
      if (data.stLogEnabled === false) {
        // allow input plugins to close the input stream, e.g. input/docker/docker.js
        eventEmitter.emit('dropLogsRequest', context, data)
        if (config.debug == true) { 
          console.log('logs dropped ', data.kubernetes.namespace + '/' + data.kubernetes.pod.name, data.message)
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
          podCache[data.kubernetes.namespace + '/' + data.kubernetes.pod.name] = pod
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
            console.log('pod spec:', JSON.stringify(pod, null, ' '))
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
  } else {
    return callback(null, data)
  }
}

module.exports = kubernetesOutputFilter