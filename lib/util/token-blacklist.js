const LRU = require('lru-cache')
const consoleLogger = require('./logger.js')

class TokenBlacklist {
  constructor (eventEmitter, maxIndexingErrors, errorRegex) {
    this.errorRegex = errorRegex || /Application not found for token (\S+),/
    this.maxIndexingErrors = maxIndexingErrors || 1 // failures before blacklisting tokens
    this.invalidTokens = new LRU({
      max: 5000,
      maxAge: 10 * 60 * 1000
    })

    eventEmitter.on(
      'error',
      function (err) {
        // blacklist tokens only when the token is unknown
        const match = String(err).match(this.errorRegex)
        const token = match && match.length > 1 && match[1]
        if (!token) {
          return
        }

        if (!this.invalidTokens.get(token)) {
          this.invalidTokens.set(token, 1)
        } else {
          this.invalidTokens.set(token, this.invalidTokens.get(token))
        }

        if (this.invalidTokens.get(token) >= this.maxIndexingErrors) {
          consoleLogger.log(`Invalid token added to blacklist ${token}`)
        }
      }.bind(this)
    )
  }

  isTokenInvalid (token) {
    return this.invalidTokens.get(token) >= this.maxIndexingErrors
  }
}

module.exports = TokenBlacklist
