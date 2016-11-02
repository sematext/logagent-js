describe('Logagent parse JSON', function () {
  it('should return corect message with timestamp', function (done) {
    this.timeout(150000)
    var Logagent = require('../lib/parser/parser.js')
    var la = new Logagent()
    la.parseLine(JSON.stringify({
      message: 'hello world',
      counter: 1
    }), 'json', function (err, data) {
      if (err) {
        done(err)
      } else {
        if (data.message === 'hello world' && data.counter === 1 && data['@timestamp']) {
          done()
        } else {
          done(new Error('message is wrong: ' + data.message))
        }
      }
    })
  })
})

describe('Logagent parse web server Log', function () {
  it('should return client_ip and status_code', function (done) {
    this.timeout(150000)
    var Logagent = require('../lib/parser/parser.js')
    var la = new Logagent()
    la.parseLine('190.160.248.117 - - [03/Apr/2016:06:25:38 +0000] "GET /about/ HTTP/1.1" 200 14243 "https://sematext.com/consulting/elasticsearch/" "Mozilla/5.0 (iPhone; CPU iPhone OS 8_1_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12B436 Twitter for iPhone"',
      'nginx', function (err, data) {
        if (err) {
          return done(err)
        } else {
          if (data.ts) {
            return done(new Error('parserd obj includes temp. ts field'))
          }
          if (data.message === 'GET /about/ HTTP/1.1' && data.client_ip === '190.160.248.117' && data.status_code === 200 && data['@timestamp']) {
            done()
          } else {
            done(new Error('message is wrong: ' + JSON.stringify(data)))
          }
        }
      })
  })
})

describe('Logagent parse unknown log', function () {
  it('should have message===logtext and timestamp', function (done) {
    this.timeout(150000)
    var Logagent = require('../lib/parser/parser.js')
    var la = new Logagent()
    var logText = 'a simple log line matching no patterns'
    la.parseLine(logText,
      'nginx', function (err, data) {
        if (err !== 'not found') {
          done(err)
        } else {
          if (data.message === logText && data['@timestamp'] && data[la.LOG_SOURCE_FIELD_NAME]) {
            done()
          } else {
            console.log(la.LOG_SOURCE_NAME)
            done(new Error('message is wrong: ' + JSON.stringify(data)))
          }
        }
      })
  })
})
