const { KubeConfig } = require('kubernetes-client')
const Client = require('kubernetes-client').Client
const Request = require('kubernetes-client/backends/request')
const kubeconfig = new KubeConfig()

var podCache = {}

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
  if (process.env.KUBERNETES_PORT_443_TCP !== undefined) {
    kubeconfig.loadFromCluster()
  } else {
    kubeconfig.loadFromDefault()
  }
  config.client = new Client({ backend: new Request({ kubeconfig }) })
  config.client.loadSpec().then(this.start.bind(this)).catch(error => {
    console.error('Error in k8s client', error)
  })
  config.getPodSpec = function (namespace, podName, cb) {
    this.client.api.v1.namespaces(namespace).pods(podName).get(cb)
  }.bind(config)
  // clean cache after 10 minutes
  // TODO: use LRU Cache
  setInterval(() => { podCache = {} }, 10 * 60 * 1000)
}

async function getPodSpec (config, namespace, podName, cb) {
  var spec = await config.client.api.v1.namespaces(namespace).pods(podName).get()
  cb(null, spec.body)
}

function processAnnotations (data) {
  if (podCache[data.kubernetes.namespace + data.kubernetes.pod.name]) {
    // get ST Logs Token from pod annotation
    var key = data.kubernetes.namespace + data.kubernetes.pod.name
    var index = podCache[key]['LOGS_TOKEN']
    // get comma separated list of fields from pod annotation
    var removeFields = podCache[key]['REMOVE_FIELDS']
    if (removeFields) {
      var fieldNames = removeFields.split(',')
      for (var i = 0; i < fieldNames.length; i++) {
        delete data[fieldNames[i]]
      }
    }
    if (index) {
      data._index = index
    }
  }
}

function enrichLogs (context, config, eventEmitter, data, callback) {
  if (data.kubernetes && data.kubernetes.pod) {
    if (podCache[data.kubernetes.namespace + data.kubernetes.pod.name]) {
      processAnnotations(data)
      callback(null, data)
    } else {
      getPodSpec(
        config,
        data.kubernetes.namespace,
        data.kubernetes.pod.name,
        function (err, pod) {
          if (err) {
            return callback(null, data)
          }
          podCache[data.kubernetes.namespace + data.kubernetes.pod.name] = pod.metadata.annotations
          // console.log('pod spec:', JSON.stringify(pod, null, ' '))
          processAnnotations(data)
          return callback(null, data)
        }
      )
    }
  } else {
    return callback(null, data)
  }
  callback(null, data)
}

module.exports = kubernetesOutputFilter