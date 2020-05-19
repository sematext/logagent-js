/* global describe, it */
var sqlFilter = require('../lib/plugins/output-filter/sql.js')
// simulate logagent eventEmitter
var eventEmitter = (eventEmitter = new (require('events').EventEmitter)())
// simualte Logagent config object
var config = {
  matchSource: /.*/,
  interval: 1,
  queries: []
}
// simulate event contect
var context = { sourceName: 'nginx' }

describe('Execute SQL on JSON', function () {
  it('should return aggergated data', function (done) {
    this.timeout(150000)

    config.queries[0] = 'SELECT SUM(size) AS size, path FROM ? group by path'
    var iterations = 10
    var size = 100
    var data = { size: size, path: '/' }

    eventEmitter.once('data.parsed', function (payload) {
      if (payload.size === iterations * size) {
        // 10 * 100 see data below
        done()
      }
    })
    eventEmitter.once('error', function errHandler1 (error) {
      done(error)
    })
    try {
      for (var i = 0; i < iterations; i++) {
        sqlFilter(context, config, eventEmitter, data, function () {})
      }
    } catch (err) {
      done(err)
    }
  })
})

describe('Emits error for invalid SQL Statements', function () {
  it('should throw error', function (done) {
    this.timeout(150000)
    eventEmitter.removeAllListeners()
    config.queries[0] =
      'INVALID-SQL SUM(size) AS size, path FROM ? group by path'
    var iterations = 1
    var size = 100
    var data = { size: size, path: '/' }
    eventEmitter.once('error', function (error) {
      // we expect the error
      if (error) {
        done()
      }
    })
    try {
      for (var i = 0; i < iterations; i++) {
        sqlFilter(context, config, eventEmitter, data, function () {})
      }
    } catch (err) {
      done(err)
    }
  })
})
