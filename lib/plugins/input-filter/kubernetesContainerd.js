// const containerdSplitRegexp = /^(.+[stdout|stderr] [F|P]) / // old
const containerdSplitRegexp = /^(.+)\s(stdout|stderr)\s(F|P)\s(.*)/ // new

// Dictionary to store sources and log lines
/**
 * Key: sourceName
 * Value (Object): { streamFlag, previousStreamFlag, logLines }
 */
const sources = {}

/**
 * sourceName - origin of the log, e.g. file name
 * config - properties from the config section for this plugin
 * data - the log message as string
 * callback - callback function (err, data).
 */
function parseK8sFileName (sourceName) {
  /**
   * SAMPLE sourceName *
   * ***************** *
   * sourceName: /var/log/containers/app-77b4d5595b-hmjxs_default_app-80209fd578c6be842b5b8a2d6389227ccab0196b7b658bd245eed4767c9b843c.log
   * fileName: app-77b4d5595b-hmjxs_default_app-80209fd578c6be842b5b8a2d6389227ccab0196b7b658bd245eed4767c9b843c.log
   * meta: {
   *   0: app-77b4d5595b-hmjxs, // pod
   *   1: default // namespace
   *   2: app-80209fd578c6be842b5b8a2d6389227ccab0196b7b658bd245eed4767c9b843c.log // container with .log suffix
   * }
   */

  // cut path from /var/log/containers/<pod_name>_<pod_namespace>_<container_name>-<container_id>.log
  // Reference: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/node/kubelet-cri-logging.md
  const index = sourceName.lastIndexOf('/')
  const fileName = sourceName.substr(index + 1, sourceName.length)
  const meta = fileName.split('_')
  const info = {}

  if (meta.length === 3) {
    const { 0: name, 1: namespace, 2: containerWithLogSuffix } = meta
    info.kubernetes = {
      pod: {
        name,
        container: {}
      },
      namespace
    }

    const positionOfNameAndIdSeparator = containerWithLogSuffix.lastIndexOf('-')
    const positionOfDotLog = containerWithLogSuffix.indexOf('.')
    const containerId = containerWithLogSuffix.substring(
      positionOfNameAndIdSeparator + 1,
      positionOfDotLog
    )
    const containerName = containerWithLogSuffix.substring(0, index)

    if (containerId) {
      info.kubernetes.pod.container.id = containerId
    }
    if (containerName) {
      info.kubernetes.pod.container.name = containerName
    }
  }
  return info
}

module.exports = function (context, config, data, callback) {
  try {
    const sections = data.split(containerdSplitRegexp)

    if (sections && sections.length === 6) {
      const k8sInfo = parseK8sFileName(context.sourceName)
      const timestamp = sections[1]
      const streamName = sections[2]
      const streamFlag = sections[3]
      const logLine = sections[4]

      if (timestamp && streamName && streamFlag) {
        k8sInfo['@timestamp'] = new Date(timestamp)
        k8sInfo.streamName = streamName
        k8sInfo.streamFlag = streamFlag

        const sourceName = context.sourceName
        if (sources[sourceName] === undefined) {
          sources[sourceName] = {}
        }
        sources[sourceName].streamFlag = k8sInfo.streamFlag

        // if it is a partial return and wait for the next chunk
        if (sources[sourceName].streamFlag === 'P') {
          if (sources[sourceName].logLines === undefined) {
            sources[sourceName].logLines = []
          }

          sources[sourceName].logLines.push(logLine)
          sources[sourceName].previousStreamFlag = 'P'

          return callback(null, null)
        }

        // if it is the final chunk of the partial log join it and ship it
        if (
          sources[sourceName].streamFlag === 'F' &&
          sources[sourceName].previousStreamFlag === 'P'
        ) {
          sources[sourceName].logLines.push(logLine)
          const joinedLogLine = sources[sourceName].logLines.join(' ')
          delete sources[sourceName]

          // a special property in context object to propagate fields to
          // the parsed object after parsing -> all logs will be enriched k8s metadata
          context.enrichEvent = k8sInfo
          return callback(null, joinedLogLine)
        }

        // if it is a full log line, enrich it, and send as is
        if (sources[sourceName].streamFlag === 'F') {
          // a special property in context object to propagate fields to
          // the parsed object after parsing -> all logs will be enriched k8s metadata
          context.enrichEvent = k8sInfo
          return callback(null, logLine)
        }
      }

      return callback(null, logLine)
    }
    return callback(null, data)
  } catch (err) {
    console.error(err)
    return callback(null, data)
  }
}
