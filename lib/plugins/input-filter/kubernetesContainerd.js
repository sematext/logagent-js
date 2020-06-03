var containerdSplitRegexp = /^(.+[stdout|stderr] [F|P]) /
const sources = {}
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

module.exports = function (context, config, data, callback) {
  try {
    const sections = data.split(containerdSplitRegexp)
    if (sections && sections.length === 3) {
      const k8sInfo = parseK8sFileName(context.sourceName)
      const meta = sections[1].split(' ')
      const logLine = sections[2]

      if (meta.length === 3 && meta[0]) {
        k8sInfo['@timestamp'] = new Date(meta[0])
        k8sInfo.streamName = meta[1]
        k8sInfo.streamFlag = meta[2]

        const sourceName = context.sourceName
        if (sources[sourceName] === undefined) {
          sources[sourceName] = {}
        }
        sources[sourceName].streamFlag = k8sInfo.streamFlag

        console.log('\n\n\n\n\n\n\n\n\n\n\n\n')
        console.log('BEFORE')
        console.log(sourceName)
        console.log(sources[sourceName])
        console.log('\n\n\n\n\n\n\n\n\n\n\n\n')

        if (sources[sourceName].streamFlag === 'P') {
          if (sources[sourceName].logLines === undefined) {
            sources[sourceName].logLines = []
          }

          sources[sourceName].logLines.push(logLine)
          sources[sourceName].previousStreamFlag = 'P'

          console.log('\n\n\n\n\n\n\n\n\n\n\n\n')
          console.log('PARTIAL')
          console.log(sourceName)
          console.log(sources[sourceName])
          console.log('\n\n\n\n\n\n\n\n\n\n\n\n')

          return callback(null, null)
        }

        if (
          sources[sourceName].streamFlag === 'F' &&
          sources[sourceName].previousStreamFlag === 'P'
        ) {
          sources[sourceName].logLines.push(logLine)
          const joinedLogLine = sources[sourceName].logLines.join(' ')          
          console.log('\n\n\n\n\n\n\n\n\n\n\n\n')
          console.log('FULL')
          console.log(sources[sourceName])
          console.log('\n\n\n\n\n\n\n\n\n\n\n\n')
          delete sources[sourceName]

          // a special property in context object to propagate fields to
          // the parsed object after parsing -> all logs will be enriched k8s metadata
          context.enrichEvent = k8sInfo
          return callback(null, joinedLogLine)
        }
      }

      console.log('\n\n\n\n\n\n\n\n\n\n\n\n\n')
      console.log(logLine)
      console.log('\n\n\n\n\n\n\n\n\n\n\n\n\n')
      return callback(null, logLine)
    }
    return callback(null, data)
  } catch (err) {
    console.error(err)
    return callback(null, data)
  }
}

// test function
// if (require.main === module) {
//   module.exports(
//     {
//       sourceName:
//         '/var/log/containers/busybox2_default_busybox-5f03725b871fe3f2cbfdde7864100a12aed2708d759bea14f8d41656accba8f6.log'
//     },
//     {},
//     '2019-03-28T23:13:41.945317977Z stdout F Mar 28 23:13:41 kube-mil01-pa1934121294964badacb5ddd3753d504c-w1 local1.notice haproxy[8]: Proxy masteretcdfrontend started',
//     console.log
//   )
// }
