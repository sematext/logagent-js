function jsonParse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

function extractJson (line, source) {
  let parsed = {}
  if (/^\[{0,1}\{.*\}]{0,1}$/.test(line)) {
    parsed = jsonParse(line)
    if (!parsed) {
      return null
    }
    return parsed
  }
}

function formatAwsEcs (context, config, eventEmitter, log, callback) {
  try {
    const parsedLog = parseAwsEcs(log, context)

    return callback(null, parsedLog)
  } catch (err) {
    console.log(err)
    return callback(null, log)
  }
}

function parseAwsEcs (log, context) {
  console.log(log)

  return log
}

module.exports = formatAwsEcs
