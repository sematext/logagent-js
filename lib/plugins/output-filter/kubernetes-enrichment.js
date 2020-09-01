const { KubeConfig } = require('kubernetes-client')
const Client = require('kubernetes-client').Client
const Request = require('kubernetes-client/backends/request')
const parser = require('../../util/parser.js')
const kubeconfig = new KubeConfig()
const consoleLogger = require('../../util/logger.js')
const LRU = require('lru-cache')
const podCache = new LRU({
  max: 2000,
  maxAge: 1000 * 60 * 60
})

var client = null
const FALSE_REGEX = /false/i
const TRUE_REGEX = /true/i
const useLogsEnabledPodAnnotation = TRUE_REGEX.test(
  process.env.USE_LOGS_ENABLED_K8S_ANNOTATIONS || 'true'
)

// The run.sh sets both LOGSENE_ENABLED_DEFAULT and LOGS_ENABLED_DEFAULT to TRUE by default.
// Users should set either of these two to FALSE to disable logging by default for all containers.
// This means you need to use whitelisting to enable logging for certain containers.
// In the ENV for those containers set 'LOGS_ENABLED=true' or 'LOGSENE_ENABLED=true'.
// const LOGS_ENABLED_DEFAULT = TRUE_REGEX.test((process.env.LOGSENE_ENABLED_DEFAULT && process.env.LOGS_ENABLED_DEFAULT) || 'true')

const LOGSENE_ENABLED_DEFAULT = TRUE_REGEX.test(
  process.env.LOGSENE_ENABLED_DEFAULT
)
const LOGS_ENABLED_DEFAULT = TRUE_REGEX.test(process.env.LOGS_ENABLED_DEFAULT)
const FINAL_LOGS_ENABLED_DEFAULT =
  LOGSENE_ENABLED_DEFAULT && LOGS_ENABLED_DEFAULT

if (process.env.KUBERNETES_PORT_443_TCP !== undefined) {
  kubeconfig.loadFromCluster()
} else {
  kubeconfig.loadFromDefault()
}
client = new Client({ backend: new Request({ kubeconfig }) })
client.loadSpec().catch(error => {
  consoleLogger.error('Error in k8s client', error)
})

function kubernetesOutputFilter (
  context,
  config,
  eventEmitter,
  data,
  callback
) {
  // we use the config object to track state of each plugin instance
  if (!config.client) {
    initKubernetesClient(context, config, eventEmitter, data, callback)
  } else {
    enrichLogs(context, config, eventEmitter, data, callback)
  }
}

function initKubernetesClient (context, config, eventEmitter, data, callback) {
  // do we run in k8s cluster?
  config.client = client
  config.getPodSpec = function (namespace, podName, cb) {
    this.client.api.v1
      .namespaces(namespace)
      .pods(podName)
      .get(cb)
  }.bind(config)

  enrichLogs(context, config, eventEmitter, data, callback)
}

const getPodSpec = async (config, namespace, podName, cb) => {
  try {
    var spec = await config.client.api.v1
      .namespaces(namespace)
      .pods(podName)
      .get()
    cb(null, spec.body)
  } catch (error) {
    cb(new Error('Kubernetes API not ready'))
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
  var removeFields =
    annotations.REMOVE_FIELDS || annotations['sematext.com/logs-remove-fields']
  if (removeFields) {
    var fieldNames = removeFields.split(',')
    for (var i = 0; i < fieldNames.length; i++) {
      delete data[fieldNames[i]]
    }
  } else {
    pod.stRemoveFields = false
  }
}

function checkLogsEnabled (pod, data, context, config) {
  if (pod.stLogEnabled !== undefined) {
    data.stLogEnabled = pod.stLogEnabled

    if (config.debug === true) {
      consoleLogger.log(
        `sematext.com/logs-enabled = ${pod.stLogEnabled} for ${pod.metadata.name}`
      )
    }

    return
  }

  pod.stLogEnabled = FINAL_LOGS_ENABLED_DEFAULT

  if (config.debug === true) {
    consoleLogger.log(
      `sematext.com/logs-enabled = ${pod.stLogEnabled} for ${pod.metadata.name}`
    )
  }

  var annotations = pod.metadata.annotations
  if (annotations) {
    var logsEnabled = annotations['sematext.com/logs-enabled']
    if (logsEnabled !== undefined) {
      if (TRUE_REGEX.test(logsEnabled)) {
        pod.stLogEnabled = true
      } else if (FALSE_REGEX.test(logsEnabled)) {
        pod.stLogEnabled = false
      }
    }
    data.stLogEnabled = pod.stLogEnabled

    if (config.debug === true) {
      consoleLogger.log(
        `sematext.com/logs-enabled = ${pod.stLogEnabled} for ${pod.metadata.name}`
      )
    }
  }
}

function checkLogsReceiverUrl (pod, data, context) {
  var annotations = pod.metadata.annotations
  if (annotations && annotations['sematext.com/logs-receiver-urls']) {
    context.logsReceivers = parser.parseReceiverList(
      annotations['sematext.com/logs-receiver-urls']
    )
    return
  }

  context.logsReceiver =
    annotations && annotations['sematext.com/logs-receiver-url']
}

function addLogsIndex (pod, data) {
  if (pod.stLogsTokenSet === false) {
    return
  }
  if (pod.stLogsTokenSet === true) {
    data._index = pod.stToken
    return
  }
  if (!pod.metadata.annotations) {
    pod.stLogsTokenSet = false
    return
  }
  // get ST Logs Token from pod annotation
  pod.stToken = pod.metadata.annotations['sematext.com/logs-token']
  // get comma separated list of fields from pod annotation
  if (pod.stToken) {
    data._index = pod.stToken
    pod.stLogsTokenSet = true
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
  }
}

function processAnnotations (
  data,
  context,
  config,
  pod,
  eventEmitter,
  callback
) {
  if (pod && pod.metadata) {
    if (useLogsEnabledPodAnnotation) {
      checkLogsEnabled(pod, data, context, config)
      // var logsEnabled = context.dockerInspect.LOGSENE_ENABLED
      if (data.stLogEnabled === false) {
        // allow input plugins to close the input stream, e.g. input/docker/docker.js
        eventEmitter.emit('dropLogsRequest', context, data)
        // logs will be droped, skip enrichment
        return callback()
      }
    }
    replaceDockerImageName(pod, data)
    removeFields(pod, data)
    addLogsIndex(pod, data)
    checkLogsReceiverUrl(pod, data, context)
    return callback(null, data)
  }

  // fallback to return data if no pod info found
  return callback(null, data)
}

function getPodCacheKey (data) {
  return `${data.kubernetes.namespace}/${data.kubernetes.pod.name}`
}

function enrichLogs (context, config, eventEmitter, data, callback) {
  if (!(data.kubernetes && data.kubernetes.pod)) {
    return callback(null, data)
  }
  const cachedPod = podCache.get(getPodCacheKey(data))
  if (cachedPod) {
    processAnnotations(data, context, config, cachedPod, eventEmitter, callback)
    if (data.stLogEnabled === false) {
      if (config.debug === true) {
        consoleLogger.log(
          'logs dropped ' +
            data.kubernetes.namespace +
            '/' +
            data.kubernetes.pod.name,
          data.message
        )
      }
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
        podCache.set(getPodCacheKey(data), pod)
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
          consoleLogger.log('pod spec: ' + JSON.stringify(pod))
        }
        processAnnotations(data, context, pod, eventEmitter, callback)
      }
    )
  }
}

module.exports = kubernetesOutputFilter
