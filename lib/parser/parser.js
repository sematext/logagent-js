'use strict'
/*
 * See the NOTICE.txt file distributed with this work for additional information
 * regarding copyright ownership.
 * Sematext licenses logagent-js to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var fs = require('fs')
var df = null
try {
  df = require('date-fns')
} catch (dfError) {
  console.error('Error loading date-fns module')
}
var crypto = require('crypto')
var MultiLine = require('./multiLine.js')
var geoip = null
var geoipCity = null
var LOG_SOURCE_FIELD_NAME = 'logSource'
var mergeConfig = require('./mergePatternFiles.js')
var consoleLogger = require('../util/logger.js')
var call = require('try-call')
var scanAllPatterns = (process.env.SCAN_ALL_PATTERNS === 'true')
var bunyanLogLevels = {
  60: 'fatal',
  50: 'error',
  40: 'warn',
  30: 'info',
  20: 'debug',
  10: 'trace'
}

var disableJsonEnrichment = (process.env.JSON_ENRICHMENT_ENABLED === 'false')

function LogParser (fileName, options, readyCallback) {
  this.fileName = fileName
  this.ready = false
  this.LOG_SOURCE_FIELD_NAME = LOG_SOURCE_FIELD_NAME
  this.readyCallback = readyCallback
  this.options = options
  this.sources = {}
  this.sourceBlacklist = {}
  this.MAX_TRAINING_LINES = (Number(process.env.LOGAGENT_MAX_TRAINING_LINES) || 100)
  this.patternMatchingDisabled = (process.env.PATTERN_MATCHING_ENABLED === 'false')
  if (fileName && fileName.length > 0) {
    this.fileName = fileName
  } else {
    this.fileName = require('path').join(__dirname, '../../patterns.yml')
  }
  this.load(this.fileName, options)
  // process.exit()
  this.initMaxmind()
  setInterval(function blackListCacheTimer () {
    // clean caches once a minute
    this.sources = {}
    this.sourceBlacklist = {}
  }.bind(this), 5 * 60000)
}
function initGeoIp (err, fileName) {
  if (err) {
    console.error('initGeoIp', err)
    this.cfg.geoIPEnabled = false
    if (this.readyCallback) {
      this.readyCallback(this)
      this.readyCallback = null
    }
    return
  }
  try {
    fs.statSync(fileName)
    geoip.open(fileName, {watchForUpdates: true}, function (err, cityLookup) {
      if (!err && cityLookup) {
        geoipCity = cityLookup
        this.cfg.geoIPEnabled = true
        if (this.cfg.globalTransform) {
          this.cfg.globalTransform = this.cfg.globalTransform.bind({
            df: df,
            geoip: geoipCity,
            enrichGeoIp: this.enrichGeoIp
          })
        }
      }
      if (this.readyCallback) {
        this.readyCallback(this)
        this.readyCallback = null
      }
    }.bind(this))
  // geoip.init(fileName, {indexCache: true, checkForUpdates: true})
  } catch (fsStatError) {
    this.cfg.geoIPEnabled = false
    if (this.readyCallback) {
      this.readyCallback(this)
      this.readyCallback = null
    }
  }
}
LogParser.prototype = {
  initMaxmind: function () {
    if (this.cfg.geoIP && (process.env.GEOIP_ENABLED === 'true' || process.env.GEOIP_ENABLED > 0)) {
      var fileName = (process.env.MAXMIND_DB_DIR || this.cfg.maxmindDbDir) + 'GeoLite2-City.mmdb'
      var cbInitGeoIp = null
      try {
        try {
          geoip = require('maxmind')
          fs.statSync(fileName)
          initGeoIp.bind(this)(null, fileName)
          cbInitGeoIp = null
        } catch (fsStatsErr) {
          cbInitGeoIp = initGeoIp.bind(this)
        }
        var maxmindUpdate = require('./maxmind-update')
        this.maxmindUpdate = maxmindUpdate(this.cfg.debug,
          (process.env.MAXMIND_DB_DIR || this.cfg.maxmindDbDir),
          cbInitGeoIp)
      } catch (err) {
        console.log(err.stack)
        if (this.readyCallback) {
          var self = this
          setTimeout(function readyCallbackTimer () {
            self.readyCallback(self)
            self.readyCallback = null
          }, 0)
        }
      }
    } else {
      if (this.readyCallback) {
        this.readyCallback(this)
      }
      this.readyCallback = null
    }
  },
  hotReload: function (changedFile) {
    var filesToLoad = this.fileName || require('path').join(__dirname, '../../patterns.yml')
    consoleLogger.log('hot reload pattern files: ' + changedFile + ' modified -> reload all ' + filesToLoad)
    this.load(filesToLoad, this.options)
  },
  load: function (names, options) {
    try {
      var defaultPatternFile = require('path').join(__dirname, '../../patterns.yml')
      var filesToLoad = []
      if (names instanceof Array) {
        if (names.length === 0) {
          filesToLoad = [defaultPatternFile]
        } else {
          filesToLoad = [defaultPatternFile].concat(names)
        }
      }
      if (typeof names === 'string') {
        filesToLoad = [defaultPatternFile].concat([names])
      }
      var self = this
      this.cfg = mergeConfig(filesToLoad, self.hotReload.bind(self))
      if (this.cfg.autohash) {
        console.log('Hashing field content enabled for field names: ' + this.cfg.autohash)
      }
      this.patterns = this.cfg.patterns
      if (options && options.whitelist) {
        this.whitelist(options.whitelist)
      }
      if (options && options.blacklist) {
        this.blacklist(options.blacklist)
      }
    } catch (e) {
      console.log(e)
      this.patterns = []
      process.exit()
    }

    return this.patterns
  },
  whitelist: function (whitelist) {
    this.patterns = this.patterns.filter(function (e) {
      return (e.sourceName && e.sourceName.match(whitelist))
    })
  },
  blacklist: function (blacklist) {
    this.patterns = this.patterns.filter(function (e) {
      return !(e.sourceName && e.sourceName.match(blacklist))
    })
  },
  enrichGeoIp: function (parsedObject, fieldName) {
    if (geoipCity != null && parsedObject[fieldName]) {
      var location = geoipCity.get(parsedObject[fieldName])
      if (location && location.country && location.city && location.city.names && location.city.names.en) {
        parsedObject['geoip'] = {
          location: [location.location.longitude, location.location.latitude],
          info: {
            country: location.country.iso_code,
            continent: location.continent.code,
            city: location.city.names.en
          }
        }
      }
    } else {
      return null
    }
  },
  getPatternsForSource: function (sourceName) {
    if (!sourceName) {
      return []
    }
    var src = this.sources[sourceName]
    if (src && src.patterns) {
      return this.sources[sourceName].patterns
    }
    var exclude = []
    var include = this.patterns.filter(function includePatternFilter (p) {
      if (sourceName && sourceName.match && sourceName.match(p.sourceName)) {
        return true
      } else {
        exclude.push(p)
        return false
      }
    })
    var patternLists = include
    if (scanAllPatterns) {
      patternLists = include.concat(exclude)
    }
    if (!src) {
      this.sources[sourceName] = {}
    }
    this.sources[sourceName].patterns = patternLists
    return patternLists
  },
  getMultiLineReader: function (sourceName, parser) {
    if (!sourceName) {
      return this.getMultiLineReader('unknown', parser)
    }
    var src = this.sources[sourceName]
    if (src && src.reader) {
      return this.sources[sourceName].reader
    } else {
      this.sources[sourceName] = {}
      var include = this.patterns.filter(function includeSourceFilter (p) {
        if (sourceName && sourceName.match && sourceName.match(p.sourceName)) {
          return true
        }
      })
      if (include.length > 0) {
        this.sources[sourceName].reader = new MultiLine(include[0].blockStart, parser)
        return this.sources[sourceName].reader
      } else {
        this.sources[sourceName].reader = new MultiLine(
          process.env.MULTILINE_DEFAULT_SEPARATOR || this.cfg.multiline.defaultSeparator || /^\S+/,
          parser)
        return this.sources[sourceName].reader
      }
    }
  },
  hash: function hash (input) {
    var sha256 = crypto.createHash(this.cfg.hashFunction || 'sha256')
    sha256.update(input.toString())
    return sha256.digest('hex')
  },
  parseDate: function (strDate, dateFormat) {
    if (!df) {
      return null
    }
    var d = null
    var now = new Date()
    if (dateFormat && strDate) {
      d = df.parse(strDate, dateFormat, now)
      if (d && df.isValid(d)) {
        return d
      }
    }
  },
  matchPatternsField: function (match, p, parsed, i) {
    var value = match[i + 1]
    // convert to number
    if (!isNaN(value) && value !== '') {
      value = Number(value)
    }
    if (this.cfg.autohash && this.cfg.autohash.test(p.fields[i])) {
      value = this.hash(value)
    }
    if (!p.fieldDefinition) {
      p.fieldDefinition = {}
    }
    var fieldDefinition = p.fieldDefinition[i]
    if (!fieldDefinition) {
      fieldDefinition = p.fieldDefinition[i] = p.fields[i].split(':')
    }
    if (fieldDefinition[0] === p.geoIP) {
      this.enrichGeoIp(parsed, p.geoIP)
    }
    if (fieldDefinition[1] && (typeof value === 'string') && /number/.test(fieldDefinition[1])) {
      if (!isNaN(value) && value !== '') {
        value = Number(value)
      } else {
        value = 0
      }
    }
    if (fieldDefinition[1] && (typeof value === 'number') && /string/.test(fieldDefinition[1])) {
      value = String(value)
    }
    parsed[fieldDefinition[0]] = value
  },
  matchPatterns: function (p, parsed, line) {
    var match = line.match(p.regex)
    if (match) {
      if (p.inputFilter !== undefined && p.inputFilter.test !== undefined) {
        if (!p.inputFilter.test(line)) {
          // calling function should drop this message
          parsed.logagentDropMessage = true
          return 1
        }
      }
      if (p.inputDrop && p.inputDrop.test) {
        if (p.inputDrop.test(line)) {
          // calling function should drop this message
          parsed.logagentDropMessage = true
          return 1
        }
      }
      parsed._type = p.type
      if (p.fields && (match.length > p.fields.length)) {
        for (var i = 0; i < p.fields.length; i++) {
          this.matchPatternsField(match, p, parsed, i)
        }
        if (parsed['ts']) {
          var timestamp = this.parseDate(parsed['ts'], p.dateFormat)
          if (timestamp) {
            parsed['@timestamp'] = timestamp
          } else {
            parsed['@timestamp'] = new Date()
          }
          // remove ts field, because Elasticsearch
          // might have problems to index it
          // it could be recognized as string or data
          // depending on its content
          delete parsed.ts
        }
        if (p.transform) {
          call(p.transform.bind(null, parsed, p), resultTransform.bind({name: p.type}))
        }
        if (p.filter) {
          call(function dropFilter () {
            if (!p.filter(parsed, p)) {
              // calling function should drop this message
              parsed.logagentDropMessage = true
              return 1
            }
          }, function dropFilterResult (err, result) {
            if (err) {
              console.log('Error in' + p.type + '.filter(): ' + err)
            }
          })
          if (parsed.logagentDropMessage) {
            return 1
          }
        }
        this.enrichGeoIp(parsed, p.geoIP)

        return 1
      }
    } else {
      return 0
    }
  },
  // optimize performance, by keeping last matched pattern
  // on top if the list,
  // assuming the next line will have the same format
  bubbleUp: function (plist, pos) {
    if (pos === 0) {
      return
    }
    // remove element on pos
    var tmp = plist[0]
    plist[0] = plist[pos]
    plist[pos] = tmp
  },
  jsonParse: function (text) {
    try {
      return JSON.parse(text)
    } catch (err) {
      return null
    }
  },
  jsonResult: function (err, result) {
    if (err) {
      this.parsed = null
    } else {
      this.parsed = result
    }
  },
  parseJson: function (line, source) {
    var parsed = {}
    if (/^\[{0,1}\{.*\}]{0,1}/.test(line.trim())) {
      parsed = this.jsonParse(line)
      if (!parsed) {
        return null
      }
      if (disableJsonEnrichment) {
        return parsed
      }
      parsed[LOG_SOURCE_FIELD_NAME] = source
      if (!(parsed['@timestamp'])) {
        if (parsed.time && parsed.time instanceof Number) {
          parsed['@timestamp'] = new Date(parsed.time)
        } else if (parsed.t && parsed.t instanceof Date) {
          parsed['@timestamp'] = new Date(parsed.t)
        } else if (parsed.timestamp && parsed.task_uuid) {
          // python eliot logs
          parsed['@timestamp'] = new Date(parsed.timestamp * 1000)
        } else {
          parsed['@timestamp'] = new Date()
        }
      } else {
        parsed['@timestamp'] = new Date(parsed['@timestamp'])
      }
      if ((!(parsed['@timestamp'] instanceof Date)) || parsed['@timestamp'] === 'Invalid Date') {
        // overwrite timestamp with a valid date
        // console.log('overwrite timestamp')
        parsed['@timestamp'] = new Date()
      }
      // adjust bunyan format to Logsene default fields
      if (parsed.msg && parsed.time && (parsed.v !== undefined) && parsed.pid && parsed.level) {
        // bunyan format
        parsed.message = parsed.msg
        delete parsed.msg
        parsed['@timestamp'] = new Date(parsed.time)
        delete parsed.time
        parsed.level = String(parsed.level)
        parsed.severity = bunyanLogLevels[parsed.level] || parsed.level || 'info'
        delete parsed.level
      }
      if (this.cfg.json !== undefined && this.cfg.json.transform !== undefined) {
        try {
          this.cfg.json.transform.call(this, source, parsed, this.cfg.json)
        } catch (err) {
          if (this.cfg.debug) {
            console.error('Error in json.transform: ' + err)
          }
        }
      }
      // TODO JSON GeoIP enrichment
      this.globalTransform(source, parsed, {require: require})
      // autohash for JSON fields
      if (this.cfg.json !== undefined && this.cfg.json.autohashFields !== undefined) {
        var fields = Object.keys(parsed)
        for (var i = 0; i < fields.length; i++) {
          if (this.cfg.json.autohashFields[fields[i]]) {
            parsed[fields[i]] = this.hash(parsed[fields[i]])
          }
        }
      }
      return parsed
    }
    return null
  },
  parseLine: function (line, source, cbf) {
    if (!line) {
      cbf('empty line', null)
    }
    var parsedJson = null
    if (this.cfg.json && (this.cfg.json.enabled)) {
      parsedJson = this.parseJson(line, source)
    }
    if (parsedJson !== null) {
      if (!parsedJson.logagentDropMessage) {
        return cbf(null, parsedJson)
      } else {
        return cbf(null, null)
      }
    }
    var self = this
    function mlReaderCb (data) {
      self._parseLine(data, source, cbf)
    }
    var br = this.getMultiLineReader(source, mlReaderCb)
    br.add(line, mlReaderCb)
  },
  globalTransform: function (source, parsed) {
    if (this.cfg.globalTransform) {
      call(this.cfg.globalTransform.bind(null, source, parsed),
        function (err, result) {
          if (err) {
            consoleLogger.error('Error in globalTransform(): ' + err + '\n\tlogSource:' + source)
          }
        })
    }
  },
  _parseLine: function (line, source, cbf) {
    if (line === null || line === '') {
      cbf('empty', null)
    }

    var parsed = {}
    if (this.cfg.originalLine === true && (!this.patternMatchingDisabled)) {
      parsed.originalLine = line
    }
    parsed[LOG_SOURCE_FIELD_NAME] = source
    if (this.patternMatchingDisabled || this.sourceBlacklist[source] >= this.MAX_TRAINING_LINES) {
      this.sourceBlacklist[source] = this.MAX_TRAINING_LINES
      var rv = {'@timestamp': new Date(), message: line}
      rv[LOG_SOURCE_FIELD_NAME] = source
      if (this.globalTransform) {
        this.globalTransform(source, rv)
      }
      return cbf('not found', rv)
    }
    var patternList = this.getPatternsForSource(source)
    if (patternList) {
      for (var k in patternList) {
        var patterns = patternList[k]
        for (var i = 0; i < patterns.match.length; i++) {
          if (this.matchPatterns(patterns.match[i], parsed, line)) {
            // this.bubbleUp(patternList, k)
            if (parsed.logagentDropMessage) {
              return cbf(null, null)
            }
            // this.sources[source].patterns = [patternList[k]]
            if (!parsed._type) {
              parsed._type = patternList[k].type
            }
            if (this.cfg.debug) {
              console.error('Pattern match: ' + parsed._type + ' #' + i, patterns.match[i].regex, JSON.stringify(patterns.match[i].fields))
            }
            if (this.globalTransform) {
              this.globalTransform(source, parsed)
            }
            this.sourceBlacklist[source] = 0
            return cbf(null, parsed)
          }
        }
      }
    }

    this.sourceBlacklist[source] = (this.sourceBlacklist[source] || 0) + 1
    var rv2 = {'@timestamp': new Date(), message: line}
    rv2[LOG_SOURCE_FIELD_NAME] = source
    if (this.globalTransform) {
      this.globalTransform(source, rv2)
    }
    return cbf('not found', rv2)
  }

}
function parseResultHandler (err, result) {
  if (err) {
    // console.log('Error parsing logs from ' + source +  ': ' + err + ' originalLine: ' + line)
    this.cbf(err, result)
  }
}
function resultTransform (err, result) {
  if (err) {
    console.log('Error in' + this.name + '.transform(): ' + err)
  }
}
module.exports = LogParser
