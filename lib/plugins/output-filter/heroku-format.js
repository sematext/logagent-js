function jsonParse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

function parseHerokuMessage (data, context) {
  if (data) {
    data._type = context.sourceName.replace('_' + context.index, '')
    data.logSource = ('' + data.logSource).replace('_' + context.index, '')
    if (!data['@timestamp']) {
      data['@timestamp'] = new Date()
    }
    if (data.message) {
      data.json = jsonParse(data.message)
    }
  }
  return data
}

module.exports = function (context, config, eventEmitter, log, callback) {
  try {
    const parsedLog = parseHerokuMessage(log, context)
    const json = parsedLog.json
    const message = parsedLog.message
    delete parsedLog.json
    delete parsedLog.message

    const structuredLog = {
      message,
      ...json,
      ...parsedLog
    }

    return callback(null, structuredLog)
  } catch (err) {
    console.error(err)
    return callback(null, log)
  }
}
