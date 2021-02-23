const durationRegex = /Duration:\s([\d+]+\.[\d+]+)\sms/
const billedDurationRegex = /Billed\sDuration:\s([\d+]+)\sms/
const memorySizeRegex = /Memory\sSize:\s([\d+]+)\sMB/
const maxMemoryUsedRegex = /Max\sMemory\sUsed:\s([\d+]+)\sMB/
const initDurationRegex = /Init\sDuration:\s([\d+]+\.[\d+]+)\sms/

function formatVercelLogsOutput (context, config, eventEmitter, log, callback) {
  try {
    const parsedLog = parseVercelLog(log)
    const error = parseVercelError(log.message)
    const logToSend = { ...parsedLog, ...error }

    if (config.debug) {
      console.log(logToSend)
    }

    if (logToSend) {
      callback(null, logToSend)
    }
  } catch (e) {
    if (config.debug) {
      console.log(e, log)
    }

    callback(null, log)
  }
}

function parseVercelLog (log) {
  // if the log is not from Lambda, return right away
  if (log && log.source && log.source !== 'lambda') {
    return log
  }

  // if the log is a cached request, handle parsing here
  if (log && log.proxy && log.proxy.cacheId) {
    const { source, ...rest } = log
    return {
      message: `Cache hit for requestId: ${rest.proxy.cacheId}`,
      source: 'cache',
      ...rest
    }
  }

  // if the log is a Lambda request enrich log with metrics
  const { message, ...rest } = log
  const splitN = message.split('\n')
  const filtered = splitN.filter(f => f.startsWith('REPORT'))
  const splitT = filtered.pop().split('\t')
  const lambdaVals = splitT.splice(1, 5)

  const duration = +lambdaVals[0].match(durationRegex)[1]
  const billedDuration = +lambdaVals[1].match(billedDurationRegex)[1]
  const memorySize = +lambdaVals[2].match(memorySizeRegex)[1]
  const maxMemoryUsed = +lambdaVals[3].match(maxMemoryUsedRegex)[1]
  const initDuration = {}
  if (lambdaVals[4] && lambdaVals[4].length) {
    initDuration.coldStart = true
    initDuration.initDuration = +lambdaVals[4].match(initDurationRegex)[1]
  }

  return {
    message,
    duration,
    billedDuration,
    memorySize,
    maxMemoryUsed,
    ...initDuration,
    ...rest
  }
}

function parseVercelError (message) {
  try {
    const errorLine = message
      .split('\n')
      .filter(line => line.length)
      .filter(
        line =>
          !(
            line.startsWith('REPORT') ||
            line.startsWith('END') ||
            line.startsWith('START')
          )
      )
      .map(line => removeErrorLineStart(line))
      .shift()

    const { errorType, errorMessage, stack } = tryParseErrorLine(errorLine)

    return {
      error: {
        type: errorType,
        message: errorMessage,
        stack: stack.join('\n')
      }
    }
  } catch (error) {
    // return empty object it is not an error message
    return {}
  }
}

function removeErrorLineStart (line) {
  const res = line.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/, '')
  return res.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    ''
  )
}

function tryParseErrorLine (line) {
  const json = line.match(/{[\s\S]*}/)
  if (json === null) {
    return line
  }
  try {
    return JSON.parse(json[0])
  } catch (e) {
    return line
  }
}

module.exports = formatVercelLogsOutput
