const parseUrlPath = ({
  useIndexFromUrlPath,
  url,
  webhookName,
  tokenBlackList,
  invalidTokenStatus
}) => {
  // Has to return an object

  const path = url.split('/')

  if (path[1] === 'health' || path[1] === 'ping') {
    return { err: { statusCode: 200, message: 'Ok\n' } }
  }

  if (useIndexFromUrlPath !== true) {
    return {}
  }

  if (path.length !== 3) {
    return {
      err: {
        statusCode: 400,
        message:
          "URL Path is invalid. Needs to be in the following format: '/<WEBHOOK_TYPE>/<TOKEN>'\n"
      }
    }
  }

  if (path[1] !== (webhookName && webhookName.toLowerCase())) {
    return {
      err: { statusCode: 400, message: `Not a ${webhookName} Webhook.\n` }
    }
  }

  const urlPath = {
    token: null
  }
  if (
    path[2] &&
    path[2].length > 31 &&
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(path[2])
  ) {
    urlPath.token = path[2]
  }

  if (
    (useIndexFromUrlPath === true && !urlPath.token) ||
    tokenBlackList.isTokenInvalid(urlPath.token)
  ) {
    return {
      err: {
        statusCode: invalidTokenStatus || 403,
        message: `Invalid LOGS_TOKEN in URL ${url}\n`
      }
    }
  }

  return urlPath
}

module.exports = {
  parseUrlPath
}
