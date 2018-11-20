var warningRegex = /warning/i
var errorRegex = /[^|\S]error|exception/i
var ignoreLogsPattern = null
var K8S = /^k8s_/
var k8sMetadata = {}
if (process.env.SEVERITY_ERROR_PATTERN) {
  errorRegex = new RegExp(process.env.SEVERITY_ERROR_PATTERN)
}
if (process.env.SEVERITY_WARNING_PATTERN) {
  warningRegex = new RegExp(process.env.SEVERITY_WARNING_PATTERN)
}
if (process.env.IGNORE_LOGS_PATTERN) {
  ignoreLogsPattern = new RegExp(process.env.IGNORE_LOGS_PATTERN)
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
    logObject.kubernetes = {}
    logObject.kubernetes.container_name = fields[1]
    logObject.kubernetes.pod_name = fields[2]
    logObject.kubernetes.namespace = fields[3]
    logObject.kubernetes.uid = fields[4]
    k8sMetadata[containerName] = logObject.kubernetes
    return logObject
  } else {
    return null
  }
}

module.exports = function enrichDockerLogs (context, config, eventEmitter, data, cb) {
  if (!context.container_name) {
    return cb(null, data)
  }
  data.container_name = context.container_name
  data.image = context.image
  data.container_id = context.container_id
  if (!data['@timestamp']) {
    data['@timestamp'] = new Date(context.time)
  }
  // Log routing, set ELasticsearch index / Logsene token from
  // container label
  if (context.dockerInspect && context.dockerInspect.LOGSENE_TOKEN) {
    context.index = context.dockerInspect.LOGSENE_TOKEN
    data._index = context.dockerInspect.LOGSENE_TOKEN
  }
  if (context.labels) {
    data.labels = context.labels
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
  parseKubernetesInfo(data.container_name, data)
  var severity = (logObject.level || logObject.lvl || logObject.severity)
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
