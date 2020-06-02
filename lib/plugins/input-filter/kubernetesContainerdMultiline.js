const containerdSplitRegexp = /^(.+[stdout|stderr] [F|P]) /
const containers = {}

function parseK8sFileName (sourceName) {
  // cut path from /var/log/containers/<pod_name>_<pod_namespace>_<container_name>-<container_id>.log
  // Reference: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/node/kubelet-cri-logging.md
  var index = sourceName.lastIndexOf('/')
  var fileName = sourceName.substr(index + 1, sourceName.length)
  var meta = fileName.split('_')
  var info = {}

  if (meta.length === 3) {
    info.kubernetes = {
      pod: { name: meta[0] },
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

/**
 * sourceName - origin of the log, e.g. file name
 * config - properties from the config section for this plugin
 * data - the log message as string
 * callback - callback function (err, data).
 */
module.exports = function (context, config, data, callback) {
  try {
    const sections = data.split(containerdSplitRegexp)
    if (sections && sections.length === 3) {
      // const k8sInfo = parseK8sFileName(context.sourceName)
      const k8sInfo = {}
      const meta = sections[1].split(' ')
      const logLine = sections[2]

      if (meta.length === 3 && meta[0]) {
        k8sInfo['@timestamp'] = new Date(meta[0])
        k8sInfo.streamName = meta[1]
        k8sInfo.streamFlag = meta[2]

        const containerId = context.sourceName
        containers[containerId] = { streamFlag: k8sInfo.streamFlag }

        if (containers[containerId].streamFlag === 'P') {
          containers[containerId].logLines.push(logLine)
          containers[containerId].previousStreamFlag = 'P'

          console.log('\n\n\n\n\n\n\n\n\n\n\n\n')
          console.log(containers[containerId].logLines)
          console.log('\n\n\n\n\n\n\n\n\n\n\n\n')

          return callback(null, null)
        } else if (
          containers[containerId].streamFlag === 'F' &&
          containers[containerId].previousStreamFlag === 'P'
        ) {
          containers[containerId].logLines.push(logLine)
          const joinedLogLine = containers[containerId].logLines.join(' ')
          delete containers[containerId]

          return callback(null, joinedLogLine)
        }
      }

      console.log('\n\n\n\n\n\n\n\n\n\n\n\n')
      console.log(logLine)
      console.log('\n\n\n\n\n\n\n\n\n\n\n\n')
      return callback(null, logLine)
    }

    return callback(null, data)
  } catch (err) {
    return callback(null, data)
  }
}
