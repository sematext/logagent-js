var log = require('graygelf')({host: 'localhost',port: 12100})
log.info.a('short', 'full', { foo: 'bar' })
