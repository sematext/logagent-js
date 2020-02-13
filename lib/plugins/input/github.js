var consoleLogger = require('../../util/logger.js')
var http = require('http')
var throng = require('throng')

function GitHub (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  if (config.worker) {
    this.config.worker = config.workers
  } else {
    this.config.workers = 0
  }
}

GitHub.prototype.start = function () {
  if (this.config.workers && this.config.workers > 0) {
    throng({
      workers: this.config.workers,
      lifetime: Infinity
    }, this.startGitHubWebhookServer.bind(this))
  } else {
    this.startGitHubWebhookServer(1)
  }
}

GitHub.prototype.stop = function (cb) {
  cb()
}

GitHub.prototype.startGitHubWebhookServer = function (id) {
  this.getHttpServer(Number(this.config.port), this.HttpHandler.bind(this))
  var exitInProgress = false
  var terminate = function (reason) {
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

GitHub.prototype.getHttpServer = function (aport, handler) {
  var _port = aport || process.env.PORT || 9200
  if (aport === true) {
    _port = process.env.PORT
  }
  var server = http.createServer(handler)
  try {
    var bindAddress = this.config.bindAddress || '0.0.0.0'
    server = server.listen(_port, bindAddress)
    consoleLogger.log('Logagent listening (HTTP GitHub): ' + bindAddress + ':' + _port + ', process id: ' + process.pid)
    return server
  } catch (err) {
    consoleLogger.log('Port in use HTTP GitHub (' + _port + '): ' + err)
  }
}

GitHub.prototype.HttpHandler = function (req, res) {
  try {
    var self = this
    var bodyIn = ''
    var path = req.url.split('/')
    var token = null
    var region = null

    // check if the useIndexFromUrlPath param is added in the YAML config
    if (self.config.useIndexFromUrlPath === true && path.length > 1) {
      if (path[1] === 'health' || path[1] === 'ping') {
        res.statusCode = 200
        res.end('ok\n')
        return
      }

      if (path[1] !== 'github') {
        res.statusCode = 400
        res.end('Not a GitHub Webhook.\n')
        return
      }

      if (path[2] && path[2].length > 31 && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(path[2])) {
        token = path[2]
      }

      if (path[3] && (path[3].toLowerCase() === 'us' || path[3].toLowerCase() === 'eu')) {
        region = path[3]
      }
    }

    req.on('data', function (data) {
      bodyIn += String(data)
    })

    req.on('end', function endHandler () {
      self.parseReq({ headers: req.headers, body: bodyIn }, token, region)
      res.writeHead(
        200,
        { 'Content-Type': 'text/plain' }
      )
      res.end('OK\n')
    })
  } catch (err) {
    res.statusCode = 500
    res.end()
    consoleLogger.error('Error in GitHub HttpHandler: ' + err)
  }
}

GitHub.prototype.parseReq = function (req, token, region) {
  const self = this

  /**
   * x-github-event" headers that define what data to collect:
   *
   * issues
   * issue_comment
   * pull_request
   * pull_request_review
   * pull_request_review_comment
   * commit_comment
   * push
   * create
   * delete
   * release
   *
   * add switch based on @event String to generate log fields
   */

  /**
   * URL fields
   * pull_request.url
   * issue.url
   * repository.url
   */

  /**
   * Number fields
   * pull_request.number
   * issue.number
   * repository.url
   */

  const event = req.headers['x-github-event']

  if (
    event !== 'issues' &&
    event !== 'issue_comment' &&
    event !== 'pull_request' &&
    event !== 'pull_request_review' &&
    event !== 'pull_request_review_comment'
  ) {
    console.log('should stop')
    // self.stop()
  } else {
    console.log('should continue')
  }

  console.log(req.headers)
  console.log(JSON.parse(req.body))

  const { action, repository, sender, pull_request: pullRequest, issue } = JSON.parse(req.body)

  const repoName = repository && repository.full_name
  const repoUrl = repository.html_url
  const prUrl = pullRequest && pullRequest.html_url
  const issueUrl = issue && issue.html_url
  const eventUrl = prUrl || issueUrl
  const senderUrl = sender && sender.html_url
  const senderName = sender && sender.login
  const senderAvatarUrl = sender && sender.avatar_url
  const number = (pullRequest && pullRequest.number) || (issue && issue.number) || null

  const parseMsg = ({ event, action, repoName, repoUrl, senderName, senderUrl, senderAvatarUrl, eventUrl, number }) =>
    `#### [[${repoName}](${repoUrl})] - [${event} #${number}](${eventUrl}) ${action} by ![](${senderAvatarUrl}&s=32) [${senderName}](${senderUrl})\n`

  const log = {
    severity: 'info',
    type: 'GitHub',
    title: `Github | ${event} ${action}`,
    message: parseMsg({ event, action, repoName, repoUrl, senderName, senderUrl, senderAvatarUrl, eventUrl, number }),
    region
  }

  self.emitEvent(log, token, region)
  return log
}

GitHub.prototype.emitEvent = function (log, token, region) {
  var context = { name: 'GitHub', sourceName: 'GitHub' }
  this.addTags(log)
  if (token) { context.index = token }
  if (region) { context.region = region }
  this.eventEmitter.emit('data.object', log, context)
}

GitHub.prototype.addTags = function (log) {
  if (this.config.tags === undefined) {
    return
  }
  log.tags = this.config.tags
}

module.exports = GitHub
