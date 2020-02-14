const consoleLogger = require('../../util/logger.js')
const http = require('http')
const throng = require('throng')

class GitHub {
  constructor (config, eventEmitter) {
    this.config = config
    this.eventEmitter = eventEmitter
    if (config.worker) {
      this.config.worker = config.workers
    } else {
      this.config.workers = 0
    }
  }

  start () {
    if (this.config.workers && this.config.workers > 0) {
      throng({
        workers: this.config.workers,
        lifetime: Infinity
      }, this.startGitHubWebhookServer.bind(this))
    } else {
      this.startGitHubWebhookServer(1)
    }
  }

  stop (cb) {
    cb()
  }

  startGitHubWebhookServer (id) {
    this.getHttpServer(Number(this.config.port), this.HttpHandler.bind(this))
    let exitInProgress = false
    const terminate = function (reason) {
      return function () {
        if (exitInProgress) {
          return
        }
        exitInProgress = true
        consoleLogger.log('Stop GitHub HTTP worker: ' + id + ', pid:' + process.pid + ', terminate reason: ' + reason + ' memory rss: ' + (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) + ' MB')
        setTimeout(process.exit, 250)
      }
    }
    process.once('SIGTERM', terminate('SIGTERM'))
    process.once('SIGINT', terminate('SIGINT'))
    process.once('exit', terminate('exit'))
  }

  getHttpServer (aport, handler) {
    let _port = aport || process.env.PORT || 9200
    if (aport === true) {
      _port = process.env.PORT
    }
    const server = http.createServer(handler)
    try {
      const bindAddress = this.config.bindAddress || '0.0.0.0'
      const serverListening = server.listen(_port, bindAddress)
      consoleLogger.log('Logagent listening (HTTP GitHub): ' + bindAddress + ':' + _port + ', process id: ' + process.pid)
      return serverListening
    } catch (err) {
      consoleLogger.log('Port in use HTTP GitHub (' + _port + '): ' + err)
    }
  }

  HttpHandler (req, res) {
    try {
      const self = this
      let bodyIn = ''

      const { token, region, err } = parseUrlPath({ useIndexFromUrlPath: this.config.useIndexFromUrlPath, path: req.url.split('/') })
      if (err) {
        res.statusCode = err.statusCode
        res.end(err.message)
        return
      }

      req.on('data', function (data) {
        bodyIn += String(data)
      })
      req.on('end', () => {
        const log = parseReq({ headers: req.headers, bodyJson: bodyIn })
        if (log) {
          self.emitEvent(log, token, region)
        }

        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('OK\n')
      })
    } catch (err) {
      res.statusCode = 500
      res.end()
      consoleLogger.error('Error in GitHub HttpHandler: ' + err)
    }
  }

  emitEvent (log, token, region) {
    const context = { name: 'GitHub', sourceName: 'GitHub' }
    if (token) { context.index = token }
    if (region) { context.region = region }

    const tags = this.config.tags
    const logToEmit = { ...log, tags }
    this.eventEmitter.emit('data.object', logToEmit, context)
  }
}

const parseReq = ({ headers, bodyJson }) => {
  const body = JSON.parse(bodyJson)
  /**
   * x-github-event" headers that define what data to collect:
   *
   * [x] issues
   * [x] issue_comment
   * [x] pull_request
   * [x] pull_request_review
   * [x] pull_request_review_comment
   * [x] commit_comment
   * [ ] push
   * [ ] create
   * [ ] delete
   * [ ] release
   *
   ********************
   **   URL fields   **
   * pull_request.html_url
   * issue.html_url
   * repository.html_url
   * comment.html_url
   ********************
   ** Numeral fields **
   * pull_request.number
   * issue.number
   * comment.commit_id
   * ******************
   **   Text fields  **
   * comment.body
   */

  const event = headers['x-github-event']
  // only send issue and pull request events down the pipeline
  if (event === 'issues' ||
    event === 'issue_comment' ||
    event === 'pull_request' ||
    event === 'pull_request_review' ||
    event === 'pull_request_review_comment') {
    return parseIssueOrPullRequest(event, body)
  } else if (event === 'commit_comment') {
    return parseCommitComment(event, body)
  } else {
    return null
  }
}

const parseUrlPath = ({ useIndexFromUrlPath, path }) => {
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

  if (path[1] !== 'github') {
    return { err: { statusCode: 400, message: 'Not a GitHub Webhook.\n' } }
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

const initEvent = (event, action) => ({
  severity: 'info',
  type: 'GitHub',
  title: `Github | ${event} ${action}`
})

const parseIssueOrPullRequest = (event, body) => {
  const {
    action,
    repository,
    sender,
    pull_request: pullRequest,
    issue
  } = body

  const repoName = repository && repository.full_name
  const repoUrl = repository.html_url
  const prUrl = pullRequest && pullRequest.html_url
  const issueUrl = issue && issue.html_url
  const eventUrl = prUrl || issueUrl
  const senderUrl = sender && sender.html_url
  const senderName = sender && sender.login
  const senderAvatarUrl = sender && sender.avatar_url
  const number = (pullRequest && pullRequest.number) || (issue && issue.number) || null

  return {
    ...initEvent(event, action),
    message: `#### [[${repoName}](${repoUrl})] - [${event} #${number}](${eventUrl}) ${action} by ![](${senderAvatarUrl}&s=32) [${senderName}](${senderUrl})\n`
  }
}

const parseCommitComment = (event, body) => {
  const {
    action,
    repository,
    sender,
    comment
  } = body

  const repoName = repository && repository.full_name
  const repoUrl = repository.html_url
  const senderUrl = sender && sender.html_url
  const senderName = sender && sender.login
  const senderAvatarUrl = sender && sender.avatar_url
  const commitId = comment && comment.commit_id
  const commitUrl = comment && comment.html_url
  const commitMessage = comment && comment.body

  return {
    ...initEvent(event, action),
    message: `#### [[${repoName}](${repoUrl})] - [${event} (${commitId})](${commitUrl}) "${commitMessage}" ${action} by ![](${senderAvatarUrl}&s=32) [${senderName}](${senderUrl})\n`
  }
}

module.exports = GitHub
