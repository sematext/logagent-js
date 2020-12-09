const consoleLogger = require('../../util/logger.js')
const http = require('http')
const throng = require('throng')
const extractTokenRegEx = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/
const tokenFormatRegEx = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
const TokenBlacklist = require('../../util/token-blacklist.js')
const zlib = require('zlib')

class AwsEcs {
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
        this.startAwsEcs.bind(this)
      )
    } else {
      this.startAwsEcs(1)
    }
  }

  stop (cb) {
    cb()
  }

  emitEvent (log, token) {
    this.addTags(log)
    const context = {
      name: 'ecs',
      sourceName: 'ecs'
    }
    if (token) {
      context.index = token
    }
    this.eventEmitter.emit('data.object', log, context)
  }

  addTags (log) {
    if (this.config.tags === undefined) {
      return
    }
    const keys = Object.keys(this.config.tags)
    for (let i = 0; i < keys.length; i++) {
      // avoid setting _index when passed in URL
      if (log[keys[i]] === undefined) {
        log[keys[i]] = this.config.tags[keys[i]]
      }
    }
  }

  getHttpServer (aport, handler) {
    let _port = aport || process.env.PORT || 6666
    if (aport === true) {
      _port = process.env.PORT
    }

    let server = http.createServer(handler)
    // Increase the connection timeout to equal the Nginx Ingress timeout of 1min.
    server.on('connection', socket => socket.setTimeout(60 * 1000))

    try {
      const bindAddress = this.config.bindAddress || '0.0.0.0'
      server = server.listen(_port, bindAddress)
      consoleLogger.log(
        'Logagent listening (HTTP ECS): ' +
          bindAddress +
          ':' +
          _port +
          ', process id: ' +
          process.pid
      )
      return server
    } catch (err) {
      consoleLogger.log('Port in use ECS (' + _port + '): ' + err)
    }
  }

  parseSourceName (headers) {
    if (!!headers && !!headers.sourcename) {
      return headers.sourcename
    }
  }

  parseRes (headers, body, token) {
    if (body.length === 0) {
      return
    }
    const self = this
    const docs = JSON.parse(body)
    if (docs && docs.length > 0) {
      for (let i = 0; i < docs.length; i++) {
        const log = docs[i]
        log['@timestamp'] = new Date()
        delete log.date
        log.message = log.log
        delete log.log

        const sourceName = self.parseSourceName(headers)
        if (sourceName) {
          log.sourceName = sourceName
        }

        self.emitEvent(log, token)
      }
    } else {
      // unknow structure, let's index the doc to ease trouble shooting
      self.emitEvent(docs, token)
    }
  }

  HttpHandler (req, res) {
    try {
      const self = this
      const path = req.url.split('/')
      let token = null
      let bodyIn = ''
      const buffer = []

      if (self.config.useIndexFromUrlPath === true && path.length > 1) {
        if (path[1] && path[1].length > 31 && tokenFormatRegEx.test(path[1])) {
          const match = path[1].match(extractTokenRegEx)
          if (match && match.length > 1) {
            token = match[1]
          }
        } else if (path[1] === 'health' || path[1] === 'ping') {
          res.statusCode = 200
          res.end('ok\n')
          return
        }
      }
      if (
        (self.config.useIndexFromUrlPath === true && !token) ||
        self.tokenBlackList.isTokenInvalid(token)
      ) {
        res.statusCode = self.config.invalidTokenStatus || 403
        res.end(`invalid logs token in url ${req.url}`)
        return
      }

      const isGzip = req.headers['content-encoding'] === 'gzip'
      // if the JSON content is gzipped this will unzip it and parse it into a stringified JSON string
      if (isGzip) {
        const gunzip = zlib.createGunzip()
        req.pipe(gunzip)

        gunzip.on('data', function onGzipHandler (data) {
          buffer.push(data.toString())
        })
        gunzip.on('end', function endGzipHandler () {
          try {
            const body = buffer.join('')
            self.parseRes(req.headers, body, token)
          } catch (err) {
            if (self.config.debug) {
              consoleLogger.error('Error in ECS HttpHandler: ' + err)
            }

            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end(`Invalid gzip input: ${err}\n`)
            return
          }
          // send response to client
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('OK\n')
        })

        return
      } else {
        req.on('data', function onHandler (data) {
          bodyIn += String(data)
        })
        req.on('end', function endHandler () {
          try {
            self.parseRes(req.headers, bodyIn, token)
          } catch (err) {
            if (self.config.debug) {
              consoleLogger.error('Error in ECS HttpHandler: ' + err)
            }

            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end(`Invalid json input: ${err}\n`)
            return
          }
          // send response to client
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('OK\n')
        })
      }
    } catch (err) {
      res.statusCode = 500
      res.end()
      consoleLogger.error('Error in ECS HttpHandler: ' + err)
    }
  }

  startAwsEcs (id) {
    this.getHttpServer(Number(this.config.port), this.HttpHandler.bind(this))
    let exitInProgress = false
    const terminate = function terminate (reason) {
      return function () {
        if (exitInProgress) {
          return
        }
        exitInProgress = true
        consoleLogger.log(
          'Stop ECS HTTP worker: ' +
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
}

module.exports = AwsEcs
