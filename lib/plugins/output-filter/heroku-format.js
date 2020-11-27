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

function filterHerokuMessage (data, context) {
  if (data) {
    data._type = context.sourceName.replace('_' + context.index, '')
    data.logSource = ('' + data.logSource).replace('_' + context.index, '')
    const msg = {
      message: data.message,
      app: data.app,
      host: data.host,
      process_type: data.process_type,
      originalLine: data.originalLine,
      severity: data.severity,
      facility: data.facility
    }

    const optionalFields = [
      'method',
      'path',
      'host',
      'request_id',
      'fwd',
      'dyno',
      'connect',
      'service',
      'status',
      'bytes'
    ]
    optionalFields.forEach(function (f) {
      if (data[f]) {
        msg[f] = data[f]
      }
    })
    if (!data['@timestamp']) {
      msg['@timestamp'] = new Date()
    }

    const json = extractJson(msg.message)
    if (json && json.message) {
      delete msg.message
    }

    return {
      ...msg,
      ...json
    }
  }
}

module.exports = function (context, config, eventEmitter, log, callback) {
  try {
    const parsedLog = filterHerokuMessage(log, context)

    return callback(null, parsedLog)
  } catch (err) {
    console.log(err)
    return callback(null, log)
  }
}
