const Parser = require('../../parser/parser.js')
const logParser = new Parser()

const SEVERITY = {
  stderr: 'err',
  stdout: 'info'
}

function jsonParse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

function extractJson (line, source) {
  if (/^\[{0,1}\{.*\}]{0,1}$/.test(line)) {
    let parsed = {}
    parsed = jsonParse(line)
    if (!parsed) {
      return null
    }
    return parsed
  }
  return null
}

function parseJsonLog (log) {
  const jsonLog = extractJson(log.message)
  if (!jsonLog) {
    return null
  }

  if (jsonLog && jsonLog.message) {
    delete log.message
  }
  return {
    ...jsonLog,
    ...log
  }
}

function formatAwsEcs (context, config, eventEmitter, log, callback) {
  try {
    log.severity = SEVERITY[log.source]
    log.source = log.sourceName
    delete log.sourceName

    // check if log.message is in JSON format, return parsed log object or null
    const parsedLog = parseJsonLog(log)
    if (parsedLog) {
      // if not null, the log is parsed, structured and sent down the pipeline
      return callback(null, parsedLog)
    }

    // if the log.message is not in JSON format then
    // we parse the log.message field with logagent patterns
    // using the log.source as the pattern sourceName (check patterns.yml)
    // for for more info
    if (log.message !== undefined) {
      logParser.parseLine(log.message, log.source, function (err, data) {
        if (err) {
          return callback(err, log)
        }

        if (data && data._type) {
          delete data['@timestamp']
          delete data.logSource
          delete data._type

          log.type = 'ecs'
          log[log.source] = {}
          Object.assign(log[log.source], data)
        }
        return callback(null, log)
      })
    }

    return callback(null, log)
  } catch (err) {
    console.log(err)
    return callback(err, log)
  }
}

module.exports = formatAwsEcs
