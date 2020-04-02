const DeviceDetector = require('device-detector-js')
const deviceDetector = new DeviceDetector()
var safeStringify = require('fast-safe-stringify')
function jsonParse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

module.exports = function (context, config, data, callback) {
  try {
    const userAgentFieldName = config.userAgentFieldName || 'useragent'
    const parsedData = jsonParse(data)
    const useragent = parsedData[userAgentFieldName]

    const device = deviceDetector.parse(useragent)
    const dataWithUseragentDetails = { ...device, ...parsedData }

    return callback(null, safeStringify(dataWithUseragentDetails))
  } catch (err) {
    return callback(null, data)
  }
}
