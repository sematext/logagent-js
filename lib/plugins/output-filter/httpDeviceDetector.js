const DeviceDetector = require('device-detector-js')
const deviceDetector = new DeviceDetector()

module.exports = function (context, config, eventEmitter, log, callback) {
  try {
    const userAgentFieldName = config.userAgentFieldName || 'user_agent'
    const userAgentDetailsFieldName =
      config.userAgentDetailsFieldName || 'user_agent_details'

    const userAgent = log[userAgentFieldName]
    const device = deviceDetector.parse(userAgent)

    const logWithUserAgentDetails = {
      [userAgentDetailsFieldName]: device,
      ...log
    }
    return callback(null, logWithUserAgentDetails)
  } catch (err) {
    return callback(null, log)
  }
}
