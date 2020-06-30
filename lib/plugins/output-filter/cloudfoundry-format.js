function jsonParse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

function extractJson (line, source) {
  var parsed = {}
  if (/^\[{0,1}\{.*\}]{0,1}$/.test(line)) {
    parsed = jsonParse(line)
    if (!parsed) {
      return null
    }
    return parsed
  }
}

function filterCloudfoundryMessage (data, context) {
  if (data) {
    data._type = context.sourceName.replace('_' + context.index, '')
    data.logSource = ('' + data.logSource).replace('_' + context.index, '')
    if (!data['@timestamp']) {
      data['@timestamp'] = new Date()
    }
    if (data.message) {
      data.json = extractJson(data.message)
    }
  }
  return data
}

module.exports = function (context, config, eventEmitter, log, callback) {
  try {
    const filteredLog = filterCloudfoundryMessage(log, context)
    const json = filteredLog.json
    delete filteredLog.json
    delete filteredLog.message
    const parsedLog = {
      ...json,
      ...filteredLog
    }

    return callback(null, parsedLog)
  } catch (err) {
    console.log(err)
    return callback(null, log)
  }
}
