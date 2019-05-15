var containerdSplitRegexp = /^(.+[stdout|stderr] [F|P]) /
/**
  * sourceName - origin of the log, e.g. file name
  * config - properties from the config section for this plugin
  * data - the log message as string
  * callback - callback function (err, data).
  */
function parseK8sFileName (sourceName) {
  // cut path from /var/log/containers/<pod_name>_<pod_namespace>_<container_name>-<container_id>.log
  // Reference: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/node/kubelet-cri-logging.md
  var index = sourceName.lastIndexOf('/')
  var fileName = sourceName.substr(index + 1, sourceName.length)
  var meta = fileName.split('_')
  var info = {}

  if (meta.length === 3) {
    info.kubernetes = {
      pod: {
        name: meta[0],
        container: {
          host: {
            hostname: process.env.SPM_REPORTED_HOSTNAME || process.env.HOSTNAME
          }
        }
      },
      namespace: meta[1]
    }
    index = meta[2].lastIndexOf('-')
    var endOfId = meta[2].indexOf('.')
    var containerName = meta[2].substring(index + 1, endOfId)
    if (containerName) {
      info.kubernetes.pod.container.name = meta[2].substring(0, index)
      info.kubernetes.pod.container.id = containerName
    }
  }
  return info
}

module.exports = function (context, config, data, callback) {
  try {
    var k8sInfo = null
    var sections = data.split(containerdSplitRegexp)
    if (sections && sections.length === 3) {
      k8sInfo = parseK8sFileName(context.sourceName)
      var meta = sections[1].split(' ')
      if (meta.length === 3 && meta[0]) {
        k8sInfo['@timestamp'] = new Date(meta[0])
        k8sInfo.streamName = meta[1]
        k8sInfo.streamFlag = meta[2]
        // a special property in context object to propagate fields to
        // the parsed object after parsing -> all logs will be enriched k8s metadata
        context.enrichEvent = k8sInfo
      }
      return callback(null, sections[2])
    }
    return callback(null, data)
  } catch (err) {
    return callback(null, data)
  }
}

// test function
if (require.main === module) {
  module.exports(
    {
      sourceName: '/var/log/containers/busybox2_default_busybox-5f03725b871fe3f2cbfdde7864100a12aed2708d759bea14f8d41656accba8f6.log'
    },
    {},
    '2019-03-28T23:13:41.945317977Z stdout F Mar 28 23:13:41 kube-mil01-pa1934121294964badacb5ddd3753d504c-w1 local1.notice haproxy[8]: Proxy masteretcdfrontend started',
    console.log)
}
