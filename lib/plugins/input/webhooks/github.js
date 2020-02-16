const http = require('http')
const throng = require('throng')
const consoleLogger = require('../../../util/logger.js')
const { parseUrlPath, initEvent } = require('./util')

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
    this.getHttpServer(Number(this.config.port), this.httpHandler.bind(this))
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

  httpHandler (req, res) {
    try {
      const self = this
      let bodyIn = ''

      const {
        token,
        err
      } = parseUrlPath({
        useIndexFromUrlPath: this.config.useIndexFromUrlPath,
        path: req.url.split('/'),
        webhookName: 'github'
      })

      if (err) {
        res.statusCode = err.statusCode
        res.end(err.message)
        return
      }

      req.on('data', function (data) {
        bodyIn += String(data)
      })
      req.on('end', () => {
        const log = parseReq({ headers: req.headers, bodyIn })
        if (log) {
          self.emitEvent(log, token)
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

  emitEvent (log, token) {
    const context = { name: 'GitHub', sourceName: 'GitHub' }
    if (token) { context.index = token }

    const tags = this.config.tags
    const logToEmit = { ...log, tags }
    this.eventEmitter.emit('data.object', logToEmit, context)
  }
}

const parseReq = ({ headers, bodyIn }) => {
  /**
   * x-github-event" headers that define what data to collect:
   *
   * [x] issues
   * [x] issue_comment
   * [x] pull_request
   * [x] pull_request_review
   * [x] pull_request_review_comment
   * [x] commit_comment
   * [x] push
   * [ ] create
   * [ ] delete
   * [ ] release
   *
   ********************
   */

  const parseGithubEventApiResponseBody = (bodyIn) => {
    const decodedBody = decodeURIComponent(bodyIn)
    const decodedBodyWithoutPayload = decodedBody.replace('payload=', '')
    return JSON.parse(decodedBodyWithoutPayload)
  }

  const body = parseGithubEventApiResponseBody(bodyIn)
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
  } else if (event === 'push') {
    return parsePush(event, body)
  } else {
    return null
  }
}

const parseRepo = (repository) => {
  if (!repository) {
    return {}
  }

  return {
    repoName: repository.full_name,
    repoUrl: repository.html_url
  }
}

const parseSender = (sender) => {
  if (!sender) {
    return {}
  }

  return {
    senderUrl: sender.html_url,
    senderName: sender.login,
    senderAvatarUrl: sender.avatar_url
  }
}

const parseIssueOrPullRequest = (event, body) => {
  const {
    action,
    repository,
    sender,
    pull_request: pullRequest,
    issue
  } = body
  if (!(issue || pullRequest)) {
    return
  }

  const {
    repoName,
    repoUrl
  } = parseRepo(repository)
  const {
    senderUrl,
    senderName,
    senderAvatarUrl
  } = parseSender(sender)

  const prUrl = pullRequest && pullRequest.html_url
  const prNumber = pullRequest && pullRequest.number

  const issueUrl = issue && issue.html_url
  const issueNumber = issue && issue.number

  const eventUrl = prUrl || issueUrl
  const number = prNumber || issueNumber || null

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `#### [[${repoName}](${repoUrl})]\n[${event} #${number}](${eventUrl}) ${action} by ![](${senderAvatarUrl}&s=25) [${senderName}](${senderUrl})\n`
  }
}

const parseCommitComment = (event, body) => {
  const {
    action,
    repository,
    sender,
    comment
  } = body
  if (!comment) {
    return
  }

  const {
    repoName,
    repoUrl
  } = parseRepo(repository)
  const {
    senderUrl,
    senderName,
    senderAvatarUrl
  } = parseSender(sender)

  const commit = {
    id: comment.commit_id,
    url: comment.html_url,
    message: comment.body
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `#### [[${repoName}](${repoUrl})]\n[${event} (${commit.id})](${commit.url}) ${action} by ![](${senderAvatarUrl}&s=25) [${senderName}](${senderUrl})\n`
  }
}

const parsePush = (event, body) => {
  const {
    ref,
    commits,
    head_commit: headCommit,
    repository,
    sender
  } = body
  const {
    repoName,
    repoUrl
  } = parseRepo(repository)
  const {
    senderUrl,
    senderName,
    senderAvatarUrl
  } = parseSender(sender)

  const generatePushEvent = ({ event, pushTo, repoName, url, commitsCount, headCommitUrl, refName, senderAvatarUrl, senderName, senderUrl }) => ({
    ...initEvent({ event, action: pushTo, webhookName: 'GitHub' }),
    message: `#### [[${repoName}](${url})]\nPushed [${commitsCount} commit(s)](${headCommitUrl}) to ${pushTo} ${refName} by ![](${senderAvatarUrl}&s=25) [${senderName}](${senderUrl})\n`
  })

  const refSplit = ref.split('/')
  const refType = refSplit[1]
  const refName = refSplit[2]

  if (refType === 'heads') {
    return generatePushEvent({
      event,
      pushTo: 'branch',
      repoName,
      url: `${repoUrl}/tree/${refName}`,
      commitsCount: commits.length,
      headCommitUrl: headCommit.url,
      refName,
      senderAvatarUrl,
      senderName,
      senderUrl
    })
  } else if (refType === 'tags') {
    return generatePushEvent({
      event,
      pushTo: 'tag',
      repoName,
      url: `${repoUrl}/releases/tag/${refName}`,
      commitsCount: commits.length,
      headCommitUrl: headCommit.url,
      refName,
      senderAvatarUrl,
      senderName,
      senderUrl
    })
  }
}

module.exports = GitHub
