/* global describe, it */
const assert = require('assert')
const crypto = require('crypto')
const sampleClientSecret = 'idmnMEd7Yx4QmgzZpZ4axXoe'
const sampleBody = {
  id: 1,
  message: '1'
}
const sampleBodyBuf = Buffer.from(JSON.stringify(sampleBody))
const sampleSignature = crypto
  .createHmac('sha1', sampleClientSecret)
  .update(sampleBodyBuf)
  .digest('hex')

const sampleReq = {
  headers: {
    'x-zeit-signature': sampleSignature
  }
}
const configWithArrayWithTwoClientSecrets = {
  clientSecrets: [sampleClientSecret, sampleClientSecret]
}
const configWithArrayWithOneClientSecret = {
  clientSecrets: [sampleClientSecret]
}
const configWithArrayWithManyClientSecretsOfWhichOnlyOneIsValid = {
  clientSecrets: [sampleClientSecret, 'kjsdfakslf', 'aslsadslkjdkld']
}
const EventEmitter = require('events')
const evem = new EventEmitter()

/**
 * Init Vercel Class
 */
const Vercel = require('../../lib/plugins/input/vercel')
const vercelWithArrayWithTwoSecrets = new Vercel(configWithArrayWithTwoClientSecrets, evem)
const vercelWithArrayWithOneSecret = new Vercel(configWithArrayWithOneClientSecret, evem)
const vercelWithArrayWithOnlyOneValidSecret = new Vercel(configWithArrayWithManyClientSecretsOfWhichOnlyOneIsValid, evem)

describe('verifySignature should', function () {
  it('return true for an array with 2 secrets', function (done) {
    const signature = vercelWithArrayWithTwoSecrets.verifySignature(sampleReq, sampleBodyBuf)
    assert.strictEqual(signature, true)
    done()
  })
  it('return true for an array with 1 secret', function (done) {
    const signature = vercelWithArrayWithOneSecret.verifySignature(sampleReq, sampleBodyBuf)
    assert.strictEqual(signature, true)
    done()
  })
  it('return true for an array with only 1 valid secret', function (done) {
    const signature = vercelWithArrayWithOnlyOneValidSecret.verifySignature(sampleReq, sampleBodyBuf)
    assert.strictEqual(signature, true)
    done()
  })
})
