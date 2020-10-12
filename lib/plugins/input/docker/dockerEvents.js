var DockerEvents = require('docker-events')
var os = require('os')
var Docker = require('dockerode')
var consoleLogger = require('../../../util/logger.js')

function DockerEventInput (config, emitter) {
  this.config = config
  this.emitter = emitter
  try {
    this.docker = new Docker()
    this.dockerEvents = new DockerEvents({ docker: this.docker })
  } catch (dockerError) {
    consoleLogger.error('Error connecting to Docker socket: ' + dockerError)
  }
}

DockerEventInput.prototype.start = function () {
  var self = this
  this.forwardEvent = function (dockerEvent) {
    try {
      if (dockerEvent.Type) {
        if (!dockerEvent.status) {
          dockerEvent.status =
            dockerEvent.Type + ' ' + (dockerEvent.Action || '')
        }
        if (dockerEvent.Actor && dockerEvent.Actor.Attributes) {
          if (dockerEvent.Actor.Attributes.container) {
            dockerEvent.id = dockerEvent.Actor.Attributes.container
          }
          if (
            dockerEvent.Actor.Attributes.name &&
            dockerEvent.Type !== 'network'
          ) {
            dockerEvent.containerName = dockerEvent.Actor.Attributes.name
          }
          if (dockerEvent.Actor.Attributes.image) {
            dockerEvent.imageName = dockerEvent.Actor.Attributes.image
          }
          dockerEvent.message = ''
          Object.keys(dockerEvent.Actor.Attributes).forEach(function (key, i) {
            if (i > 0) {
              dockerEvent.message += ', '
            }
            dockerEvent.message += key + ':' + dockerEvent.Actor.Attributes[key]
          })
        }
      }
      var msgStr =
        'Docker Event: ' +
        dockerEvent.status +
        ' ' +
        (dockerEvent.containerName || dockerEvent.from || '') +
        ' ' +
        (dockerEvent.id || '') +
        ' ' +
        (dockerEvent.message || '')
      var msg = {
        dockerEventType: '' + dockerEvent.Type,
        dockerEventAction: '' + dockerEvent.Action,
        dockerEventFrom: '' + dockerEvent.from,
        dockerEventImageName: dockerEvent.imageName,
        message: msgStr,
        image_name: dockerEvent.from,
        container_id: dockerEvent.id,
        container_name: dockerEvent.containerName,
        dockerEventHost: process.env.SPM_REPORTED_HOSTNAME || os.hostname(),
        tags: [
          'docker',
          process.env.SPM_REPORTED_HOSTNAME ||
            process.env.HOSTNAME ||
            os.hostname(),
          dockerEvent.status
        ]
      }
      if (dockerEvent.id && typeof dockerEvent.id === 'string') {
        msg.tags.push(dockerEvent.id.substring(0, 12))
      }
      if (self.logsene) {
        self.logsene.log('info', msgStr, msg)
      }
      var type = dockerEvent.status || 'docker'
      type = type.replace(/[\W]/gi, '_')
      if (/exec_.*/.test(type)) {
        type = 'exec'
      }
      msg.title =
        'docker ' +
        dockerEvent.status +
        ' ' +
        (dockerEvent.containerName || dockerEvent.imageName || '')
      self.emitter.emit('data.parsed', msg)
    } catch (err) {
      console.error(err)
    }
  }

  this.dockerEvents.on('connect', function () {
    self.dockerEvents.on('_message', self.forwardEvent)
  })
  this.dockerEvents.on('disconnect', function () {
    self.dockerEvents.removeListener('_message', self.forwardEvent)
  })
  this.dockerEvents.on('error', function (err) {
    consoleLogger.error('Error connecting to Docker socket: ' + err)
  })
  this.dockerEvents.start()
  return this
}

DockerEventInput.prototype.stop = function () {
  this.dockerEvents.stop()
}

module.exports = DockerEventInput
