var assert = require('assert')
var OutputPrometheusAlertmanager = require('../lib/plugins/output/prometheus-alertmanager.js')
describe('OutputPrometheusAlertmanager', function () {
  describe('#new', function () {
    it('throws if no config given', function () {
      assert.throws(function () {
        new OutputPrometheusAlertmanager({})
      }, /Please specify Prometheus Alertmanager "url"/)
    })

    it('throws if no config.url given', function () {
      assert.throws(function () {
        new OutputPrometheusAlertmanager()
      }, /Please specify Prometheus Alertmanager "url"/)
    })

    it('returns instance', function () {
      new OutputPrometheusAlertmanager({url: 'foo'})
    })
  })

  describe('#buildAlert', function () {
    it('return alert', function () {
      var output = new OutputPrometheusAlertmanager({url: 'foo'})
      assert.deepEqual(output.buildAlert(), {
        labels: {},
        annotations: {}
      })
    })

    it('return alert with templated values', function () {
      var output = new OutputPrometheusAlertmanager({
        url: 'foo',
        alertTemplate: {
          generatorURL: 'http://foo?myVarA={myVarA}&myVarB={myVarB}',
          labels: {
            myLabel: '{myVarA}-{myVarB}'
          },
          annotations: {
            myAnnotation: '{myVarA} and {myVarB}'
          }
        }
      })
      assert.deepEqual(output.buildAlert({
        myVarA: 'valOfMyVarA',
        myVarB: 'valOfMyVarB'
      }), {
        generatorURL: 'http://foo?myVarA=valOfMyVarA&myVarB=valOfMyVarB',
        labels: {
          myLabel: 'valOfMyVarA-valOfMyVarB'
        },
        annotations: {
          myAnnotation: 'valOfMyVarA and valOfMyVarB'
        }
      })
    })
  })
})
