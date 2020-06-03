const containerdSplitRegexp = /^(.+[stdout|stderr] [F|P]) /
const sources = {}
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
      const k8sInfo = {}
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
    console.error(err)
    return callback(null, data)
  }
}
