const parseUrlPath = ({ useIndexFromUrlPath, path, webhookName }) => {
  // Has to return an object

  if (useIndexFromUrlPath !== true) {
    return {}
  }

  if (path.length !== 3) {
    return { err: { statusCode: 400, message: 'URL Path is invalid. Needs to be in the following format: \'/<WEBHOOK_TYPE>/<TOKEN>\'\n' } }
  }

  if (path[1] === 'health' || path[1] === 'ping') {
    return { err: { statusCode: 200, message: 'Ok\n' } }
  }

  if (path[1] !== (webhookName && webhookName.toLowerCase())) {
    return { err: { statusCode: 400, message: `Not a ${webhookName} Webhook.\n` } }
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

  return urlPath
}

const initEvent = ({ event, action, webhookName }) => ({
  severity: 'info',
  type: webhookName,
  title: `${webhookName} | ${capitalize(event)} ${capitalize(action)}`
})

const initRepoMessage = ({ repoName, repoUrl }) =>
  `[[${repoName}](${repoUrl})]`

const initAuthorMessage = ({ senderAvatarUrl, senderName, senderUrl }) =>
  `![](${senderAvatarUrl}&s=25) [${senderName}](${senderUrl})`

const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

module.exports = {
  parseUrlPath,
  initEvent,
  initAuthorMessage,
  initRepoMessage
}
