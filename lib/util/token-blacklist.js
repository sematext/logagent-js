const LRU = require('lru-cache')
const consoleLogger = require('./logger.js')

class TokenBlacklist {
  constructor(eventEmitter, maxIndexingErrors, errorRegex) {
    this.errorRegex = errorRegex || /Application not found for token (\S+),/
    this.maxIndexingErrors = maxIndexingErrors || 1 // failures before blacklisting tokens 
    this.invalidTokens = new LRU({
      max: 5000,
      maxAge: 10 * 60 * 1000
    })
    eventEmitter.on('error', function (err) {
      // blacklist tokens ony when the token is unknown 
      let match = String(err).match(this.errorRegex)
      if (match && match.length > 1) {
        if (!this.invalidTokens.get(match[1])) {
          this.invalidTokens.set(match[1], 1)
        } else {
          this.invalidTokens.set(match[1], this.invalidTokens.get(match[1]))
        }
        if (this.invalidTokens.get(match[1]) >= this.maxIndexingErrors) {
          consoleLogger.log(`Invalid token added to blacklist ${match[1]}`)
        }
      }
    }.bind(this))
  }
  isTokenInvalid(token) {
    return this.invalidTokens.get(token) >= this.maxIndexingErrors
  }
}

module.exports = TokenBlacklist