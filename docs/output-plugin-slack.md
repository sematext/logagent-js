# Plugin: Slack output

Plugin to forward messages via Slack "Incoming-Webhook" integration.

Applications: 
- Alert Notifications

## Configuration

```

output:
  stdout: yaml 
  slack:
    debug: false
    module: slack-webhook
    # Webhook URL
    url: https://hooks.slack.com/services/T0H3BXXXX/B55MHXXXX/dXSsTivciZACphXXXXXXXX
    matchSource: !!js/regexp /.*/
    # filter function to decide for notification via slack 
    filter: !!js/function > 
      function (context, data, config) {
        if (data.status > 399 && data.error_count > config.minErrors) {
          return true
        } else {
          return false
        }
      }
    # custom property for filter function above
    minErrors: 3
    # yaml, ld-json, json or template
    format: template
    # Text template for slack message
    # all parsed fields can be used
    template: ':st: <@stefan|stefan> {logSource}: {error_count} http errors "{status}"'
    # Payload template (see Slack API)
    payload:
      username: stefan
      channel: '#test'
      icon_emoji: ':smile:'
      attachments: 
        - title: Alert
          color: danger

```

Start logagent

```
logagent --config myconfig.yml
```

