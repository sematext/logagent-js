const durationRegex = /Duration:\s([\d+]+\.[\d+]+)\sms/
const billedDurationRegex = /Billed\sDuration:\s([\d+]+)\sms/
const memorySizeRegex = /Memory\sSize:\s([\d+]+)\sMB/
const maxMemoryUsedRegex = /Max\sMemory\sUsed:\s([\d+]+)\sMB/
const initDurationRegex = /Init\sDuration:\s([\d+]+\.[\d+]+)\sms/

function formatVercelLogsOutput (context, config, eventEmitter, log, callback) {
  try {
    const parsedLog = parseVercelLog(log)

    if (config.debug) {
      console.log(parsedLog)
    }

    if (parsedLog) {
      callback(null, parsedLog)
    }
  } catch (e) {
    callback(e, log)
  }
}

function parseVercelLog (log) {
  if (log && log.source && log.source !== 'lambda') {
    return log
  }

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

module.exports = formatVercelLogsOutput
