function ServerMonitor (config) {
  this.config = config.configFile.input.serverMonitor
}

ServerMonitor.prototype = {
  start: function () {
    if (this.config && this.config.SPM_TOKEN) {
      process.env.SPM_TOKEN = this.config.SPM_TOKEN
      process.env.SPM_LOG_TO_CONSOLE = 'true'
      var SpmAgent = require('spm-agent')
      var OsAgent = require('spm-agent-os')
      this.spmAgent = new SpmAgent()
      this.spmAgent.createAgent(new OsAgent())
    }
  },
  stop: function (cb) {
    if (this.agent && this.agent.stop) {
      this.spmAgent.stop()
      cb()
    }
  }
}

module.exports = ServerMonitor
