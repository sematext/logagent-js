/* global describe, it */
process.env.GEOIP_ENABLED = 'true'
// var util = require('util')
var Logagent = require('../lib/parser/parser.js')
describe('Logagent parse JSON', function () {
  it('should return correct message with timestamp', function (done) {
    this.timeout(30000)
    var doneFunc = function (err, data) {
      if (err) {
        done(err)
      } else {
        if (data && data.message === 'hello world' && data.counter === 1 && data['@timestamp'] !== undefined) {
          done()
        } else {
          done(new Error('message is wrong: ' + data.message))
        }
      }
    }
    var la = new Logagent()
    la.cfg.json = {enabled: true, debug: true}
    la.parseLine(
      JSON.stringify({message: 'hello world', counter: 1}),
      'json',
      doneFunc)
  })
})

describe('Logagent parse bunyan JSON', function () {
  it('should return correct message with timestamp', function (done) {
    this.timeout(150000)
    var la = new Logagent()
    la.parseLine(JSON.stringify({
      pid: 6023,
      level: 30,
      msg: 'hello world',
      time: '2017-02-08T21:13:49.515Z',
      v: 0,
      counter: 1
    }), 'json', function (err, data) {
      if (err) {
        done(err)
      } else {
        if (data.message === 'hello world' && data.counter === 1) {
          done()
        } else {
          done(new Error('message is wrong: ' + data['@timestamp'] + ' ' + data.message))
        }
      }
    })
  })
})

describe('Logagent parse web server Log', function () {
  it('should return client_ip, status_code, geo ip location', function (done) {
    this.timeout(150000)
    this.la = new Logagent(null, null, function ready (laReady) {
      // console.log('ready', arguments)
      laReady.parseLine('91.67.80.14 - - [03/Apr/2016:06:25:38 +0000] "GET /about/ HTTP/1.1" 200 14243 "https://sematext.com/consulting/elasticsearch/" "Mozilla/5.0 (iPhone; CPU iPhone OS 8_1_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12B436 Twitter for iPhone"',
        'nginx', function (err, data) {
          if (err) {
            return done(err)
          } else {
            if (data.ts) {
              return done(new Error('parserd obj includes temp. ts field'))
            }
            if (data.message === 'GET /about/' && data.client_ip === '91.67.80.14' && data.geoip && data.status_code === 200 && data['@timestamp']) {
              done()
            } else {
              done(new Error('message is wrong: ' + JSON.stringify(data)))
            }
          }
        })
    })
  })
})

describe('Logagent parse unknown log', function () {
  it('should have message===logtext and timestamp', function (done) {
    this.timeout(150000)
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
