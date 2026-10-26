/* global describe, it */
var assert = require('assert')
var Logagent = require('../lib/parser/parser.js')

describe('JSON numeric time fields', function () {
  var times = [1700000000123, 0, -1000]
  times.forEach(function (time) {
    it('preserves epoch milliseconds ' + time, function (done) {
      var parser = new Logagent()
      parser.cfg.json = { enabled: true }
      var line = JSON.stringify({ time: time, message: 'historical event' })
      parser.parseLine(line, 'json', function (err, data) {
        try {
          assert.ifError(err)
          assert.strictEqual(data['@timestamp'].getTime(), time)
          assert.strictEqual(data.time, time)
          assert.strictEqual(data.message, 'historical event')
          done()
        } catch (error) {
          done(error)
        }
      })
    })
  })

  it('keeps an explicit timestamp ahead of numeric time', function (done) {
    var parser = new Logagent()
    parser.cfg.json = { enabled: true }
    var timestamp = '2020-01-02T03:04:05.000Z'
    var line = JSON.stringify({
      '@timestamp': timestamp,
      time: 1700000000123,
      message: 'explicit timestamp'
    })
    parser.parseLine(line, 'json', function (err, data) {
      try {
        assert.ifError(err)
        assert.strictEqual(data['@timestamp'].toISOString(), timestamp)
        done()
      } catch (error) {
        done(error)
      }
    })
  })

  it('still supplies a timestamp when time is absent', function (done) {
    var parser = new Logagent()
    parser.cfg.json = { enabled: true }
    var before = Date.now()
    parser.parseLine('{"message":"no time"}', 'json', function (err, data) {
      try {
        assert.ifError(err)
        assert.ok(data['@timestamp'].getTime() >= before)
        assert.ok(data['@timestamp'].getTime() <= Date.now())
        done()
      } catch (error) {
        done(error)
      }
    })
  })
})
