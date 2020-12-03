const Parser = require('../../parser/parser.js')
const logParser = new Parser()

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
    // optional parsing of message field with logagent patterns
    if (config.parseMessageField === true && log.message !== undefined) {
      logParser.parseLine(log.message, log.sourceName, function (err, data) {
        if (err) {
          return callback(err, log)
        }

        if (data && data._type) {
          const type = `${data._type}`
          delete data['@timestamp']
          delete data.logSource
          delete data._type
          log[type] = {}
          Object.assign(log[type], data)
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
