'use strict'
var prettyjson = require('prettyjson')
var safeStringify = require('fast-safe-stringify')
var format = require('string-template')
var request = require('request')
function OutputSlackWebhook (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}

OutputSlackWebhook.prototype.match = function (data, context) {
  var rv = true
  if (this.config.matchSource) {
    rv = this.config.matchSource.test(context.sourceName)
  }
  if (rv && this.config.filter) {
    rv = this.config.filter(context, data, this.config)
  }
  return rv
}

OutputSlackWebhook.prototype.eventHandler = function (data, context) {
  if (this.config.suppress) {
    return
  }
  if (this.match(data, context)) {
    var slackMessage = ''
    var payload = this.config.payload
    if (this.config.format === 'json') {
      slackMessage = JSON.stringify(data, null, '\t')
    } else if (this.config.format === 'yaml') {
      slackMessage = prettyjson.render(data, { noColor: true }) + '\n'
    } else if (this.config.format === 'ld-json') {
      slackMessage = safeStringify(data)
    } else if (this.config.template) {
      slackMessage = format(this.config.template, data)
    }
    if (payload.attachments && payload.attachments[0]) {
      payload.attachments[0].text = slackMessage
    } else {
      payload.text = slackMessage
    }

    if (payload) {
      var options = {
        url: this.config.url,
        headers: {
          'Content-Type': 'application/json'
        },
        json: payload
      }
    }
    request.post(
      options,
      function responseHandler (error, response, body) {
        if (!error && response.statusCode < 300) {
          if (this.debug === true) {
            console.error(
              new Date(),
              'Slack Message sent: ' +
                'payload=' +
                JSON.stringify(this.payload),
              body
            )
          }
        } else {
          console.error(new Date(), 'Error in slack webhook:', error, body)
        }
      }.bind({ debug: this.config.debug, payload: payload })
    )
  }
}

OutputSlackWebhook.prototype.start = function () {
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

OutputSlackWebhook.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = OutputSlackWebhook
