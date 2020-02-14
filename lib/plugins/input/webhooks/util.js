const parseUrlPath = ({ useIndexFromUrlPath, path, webhookName }) => {
  // Has to return an object

  if (useIndexFromUrlPath !== true) {
    return {}
  }

  if (path.length !== 4) {
    return { err: { statusCode: 400, message: 'URL Path is invalid. Needs to be in the following format: \'/<WEBHOOK_TYPE>/<TOKEN>/<REGION>\'\n' } }
  }

  if (path[1] === 'health' || path[1] === 'ping') {
    return { err: { statusCode: 200, message: 'Ok\n' } }
  }

  if (path[1] !== (webhookName && webhookName.toLowerCase())) {
    return { err: { statusCode: 400, message: `Not a ${webhookName} Webhook.\n` } }
  }

  const urlPath = {
    token: null,
    region: null
  }
  if (
    path[2] &&
    path[2].length > 31 &&
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(path[2])
  ) {
    urlPath.token = path[2]
  }
  if (
    path[3] &&
    (path[3].toLowerCase() === 'us' || path[3].toLowerCase() === 'eu')
  ) {
    urlPath.region = path[3]
  }

  return urlPath
}

const initEvent = ({ event, action, webhookName }) => ({
  severity: 'info',
  type: webhookName,
  title: `${webhookName} | ${event} ${action}`
})

module.exports = {
  parseUrlPath,
  initEvent
}
