var logger = require('../logger.js')
function TokenMapper(indices) {
	this.indices = indices
	this.sourceCache = {}
}
TokenMapper.prototype.findToken = function(logSource) {
	var rv = this.sourceCache[logSource]
	if (rv) {
		return rv
	}
	Object.keys(this.indices).some(function (token) {
		return this.indices[token].some(function (regex) {
			var r = new RegExp (regex)
			if (r.test(logSource)) {
				rv = token
				this.sourceCache[logSource]=token
				// stops looping
				return	true
			} else {
				// continue with next
				return false
			}
		}.bind(this))
	}.bind(this))
	// logger.debug('found token for ' + logSource +': ' +rv)
	return rv
}
module.exports=TokenMapper

function test (done) {
	console.log('test')
	tm = new TokenMapper({
		'TOKEN1-ABCD': ['.*access.*', '.*nginx.*'],
		'TOKEN2': ['.*myApp.*', '.*test.*']
	})
	if (tm.findToken('/var/log/access.log') == 'TOKEN1-ABCD')
		done()
	else
		done(new Error('token not found'))	
}
if (require.main === module) {
  test(console.log)
}	
