const http = require('http')
const throng = require('throng')
const consoleLogger = require('../../../util/logger.js')
const TokenBlacklist = require('../../../util/token-blacklist')
const { parseUrlPath } = require('./util')

class GitHub {
  constructor (config, eventEmitter) {
    this.config = config
    this.eventEmitter = eventEmitter
    this.tokenBlackList = new TokenBlacklist(eventEmitter)

    if (config.workers) {
      this.config.workers = config.workers
    } else {
      this.config.workers = 0
    }
  }

  start () {
    if (this.config.workers && this.config.workers > 0) {
      throng(
        {
          workers: this.config.workers,
          lifetime: Infinity
        },
        this.startGitHubWebhookServer.bind(this)
      )
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
        consoleLogger.log(
          'Stop GitHub HTTP worker: ' +
            id +
            ', pid:' +
            process.pid +
            ', terminate reason: ' +
            reason +
            ' memory rss: ' +
            (process.memoryUsage().rss / (1024 * 1024)).toFixed(2) +
            ' MB'
        )
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

    // Increase the connection timeout to equal the Nginx Ingress timeout of 1min.
    server.on('connection', socket => socket.setTimeout(60 * 1000))

    try {
      const bindAddress = this.config.bindAddress || '0.0.0.0'
      const serverListening = server.listen(_port, bindAddress)
      consoleLogger.log(
        'Logagent listening (HTTP GitHub): ' +
          bindAddress +
          ':' +
          _port +
          ', process id: ' +
          process.pid
      )
      return serverListening
    } catch (err) {
      consoleLogger.log('Port in use HTTP GitHub (' + _port + '): ' + err)
    }
  }

  httpHandler (req, res) {
    try {
      const emitEvent = this.emitEvent.bind(this)
      let bodyIn = ''

      const { token, err } = parseUrlPath({
        useIndexFromUrlPath: this.config.useIndexFromUrlPath,
        url: req.url,
        webhookName: 'github',
        tokenBlackList: this.tokenBlackList,
        invalidTokenStatus: this.config.invalidTokenStatus
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
          emitEvent(log, token)
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
    if (token) {
      context.index = token
    }

    const tags = this.config.tags
    const logToEmit = { ...log, tags }
    this.eventEmitter.emit('data.object', logToEmit, context)
  }
}

const parseReq = ({ headers, bodyIn }) => {
  const parseGithubEventApiResponseBody = bodyIn => {
    const decodedBody = decodeURIComponent(bodyIn)
    const decodedBodyWithoutPayload = decodedBody.replace('payload=', '')
    return JSON.parse(decodedBodyWithoutPayload)
  }

  const body = parseGithubEventApiResponseBody(bodyIn)
  const event = headers['x-github-event']
  return { event, body }
}

module.exports = GitHub
