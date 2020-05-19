var warningRegex = /warning/i
var errorRegex = /[^|\S]error|exception/i
var K8S = /^k8s_/

var parser = require('../../util/parser.js')

var k8sMetadata = {}
if (process.env.SEVERITY_ERROR_PATTERN) {
  errorRegex = new RegExp(process.env.SEVERITY_ERROR_PATTERN)
}
if (process.env.SEVERITY_WARNING_PATTERN) {
  warningRegex = new RegExp(process.env.SEVERITY_WARNING_PATTERN)
}

function parseKubernetesInfo (containerName, logObject) {
  // containers managed by Kubernetes have a prefix "k8s_", reference:
  // https://github.com/kubernetes/kubernetes/blob/f5d9c430e9168cf5c41197b8a4e457981cb031df/pkg/kubelet/dockertools/docker.go#L85
  if (!K8S.test(containerName)) {
    return null
  }
  // cache for meta data
  if (k8sMetadata[containerName]) {
    logObject.kubernetes = k8sMetadata[containerName]
    return logObject
  }
  var fields = containerName.split('_')
  if (fields.length >= 4) {
    // example: k8s_sematext-agent.c56a873d_sematext-agent-qo2yf_default_e94b48c5-e63b-11e5-a8ec-0401b386ea01_8898bc93
    if (fields[0] !== 'k8s') {
      return null
    }
    logObject.kubernetes = {
      pod: {
        name: fields[2],
        uid: fields[4],
        container: {
          // container name in pod
          name: fields[1]
        }
      },
      namespace: fields[3]
    }
    k8sMetadata[containerName] = logObject.kubernetes
    return logObject
  } else {
    return null
  }
}

module.exports = function enrichDockerLogs (
  context,
  config,
  eventEmitter,
  data,
  cb
) {
  if (!context.container_name) {
    return cb(null, data)
  }
  data.container = {
    id: context.container_long_id,
    type: 'docker',
    name: context.container_name,
    image: parser.parseImage(context.image || '')
  }
  data.os = {
    host: process.env.SPM_REPORTED_HOSTNAME
  }
  if (!data['@timestamp']) {
    data['@timestamp'] = new Date(context.time)
  }
  // Log routing, set Elasticsearch index / Logsene token from
  // container label
  if (context.dockerInspect && context.dockerInspect.LOGSENE_TOKEN) {
    context.index = context.dockerInspect.LOGSENE_TOKEN
    data._index = context.dockerInspect.LOGSENE_TOKEN
  }
  if (context.dockerInspect && context.dockerInspect.LOGS_RECEIVER_URL) {
    context.elasticsearchUrl = context.dockerInspect.LOGS_RECEIVER_URL
  }
  if (context.labels) {
    data.labels = context.labels
  }

  if (
    context.dockerInspect &&
    context.dockerInspect.Config &&
    context.dockerInspect.Config.Labels
  ) {
    var swarmInfo = {}
    var stackName =
      context.dockerInspect.Config.Labels['com.docker.stack.namespace']
    if (stackName) {
      swarmInfo.stack = {
        name: stackName
      }
      data.swarm = swarmInfo
    }
    var serviceName =
      context.dockerInspect.Config.Labels['com.docker.swarm.service.name']
    if (serviceName) {
      swarmInfo.service = {
        name: serviceName
      }
      data.swarm = swarmInfo
    }
  }
  // set logs receiver urls for output plugins when you have multiple URLS
  if (context.dockerInspect && context.dockerInspect.LOGS_RECEIVER_URLS) {
    context.logsReceivers = context.dockerInspect.LOGS_RECEIVER_URLS
  }
  // set logs receiver urls for output plugins when you have one URL
  if (context.dockerInspect && context.dockerInspect.LOGS_RECEIVER_URL) {
    context.logsReceiver = context.dockerInspect.LOGS_RECEIVER_URL
  }
  // set logs destination / name of ES output module
  if (context.dockerInspect && context.dockerInspect.LOGS_DESTINATION) {
    context.logsDestination = context.dockerInspect.LOGS_DESTINATION
  }

  var logObject = data
  // make sure that top level message field is a String
  var messageString = logObject.message || logObject.msg || logObject.MESSAGE
  if (typeof messageString === 'object') {
    messageString = JSON.stringify(messageString)
  } else if (typeof messageString !== 'string') {
    messageString = String(messageString)
  }
  if (logObject.message) {
    logObject.message = messageString
  }
  if (data && data.container && data.container.name) {
    parseKubernetesInfo(data.container.name, data)
  }
  var severity = logObject.level || logObject.lvl || logObject.severity
  if (config.autodetectSeverity && logObject.message && !severity) {
    // detect severity
    var testString = String(logObject.message).substring(0, 80)
    if (errorRegex.test(testString)) {
      severity = 'error'
    }
    if (warningRegex.test(testString)) {
      severity = 'warning'
    }
    testString = null
    logObject.severity = logObject.severity || severity || 'info'
  }
  cb(null, data)
}
