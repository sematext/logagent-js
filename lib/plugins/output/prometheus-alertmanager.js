'use strict'
var format = require('string-template')
var request
try {
  request = require('request')
} catch (e) {
  request = {
    post: function () {
      require('request')
    }
  }
}
function OutputPrometheusAlertmanager (config, eventEmitter) {
  if (!config || !config.url) {
    throw new TypeError('Please specify Prometheus Alertmanager "url"')
  }
  this.config = config
  this.eventEmitter = eventEmitter
}

/* see https://prometheus.io/docs/alerting/clients/
/* payload:
[
  {
    "labels": {
      "<labelname>": "<labelvalue>",
      ...
    },
    "annotations": {
      "<labelname>": "<labelvalue>",
    },
    "startsAt": "<rfc3339>",
    "endsAt": "<rfc3339>",
    "generatorURL": "<generator_url>"
  },
  ...
]
*/
OutputPrometheusAlertmanager.prototype.buildAlert = function (data, context) {
  var alert = {
    'labels': {},
    'annotations': {}
  }
  if (this.config.alertTemplate) {
    if (this.config.alertTemplate.generatorURL) {
      alert.generatorURL = format(this.config.alertTemplate.generatorURL, data)
    }
    var labels = Object.keys(this.config.alertTemplate.labels || {})
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i]
      alert.labels[label] = format(this.config.alertTemplate.labels[label], data)
    }
    var annotations = Object.keys(this.config.alertTemplate.annotations || {})
    for (var i = 0; i < annotations.length; i++) {
      var label = annotations[i]
      alert.annotations[label] = format(this.config.alertTemplate.annotations[label], data)
    }
  }
  return alert
}

OutputPrometheusAlertmanager.prototype.eventHandler = function (data, context) {
  var alert = this.buildAlert(data, context)
  var options = {
    url: this.config.url + '/api/v1/alerts',
    headers: {
      'Content-Type': 'application/json'
    },
    json: [
      alert
    ]
  }
  request.post(options, function responseHandler (error, response, body) {
    if (!error && response.statusCode < 300) {
      if (this.debug === true) {
        console.error(new Date(), 'Alert sent to Prometheus Alertmanager: alert=' + JSON.stringify(this.alert), body)
      }
    } else {
      console.error(new Date(), 'Error while alerting Prometheus Alertmanager:', error, body)
    }
  }.bind({debug: this.config.debug, alert: alert}))
}

OutputPrometheusAlertmanager.prototype.start = function () {
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

OutputPrometheusAlertmanager.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = OutputPrometheusAlertmanager
