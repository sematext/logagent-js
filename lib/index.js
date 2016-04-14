/*
 * @copyright Copyright (c) Sematext Group, Inc. - All Rights Reserved
 *
 * @licence logparser-js is free-to-use, proprietary software.
 * THIS IS PROPRIETARY SOURCE CODE OF Sematext Group, Inc. (Sematext)
 * This source code may not be copied, reverse engineered, or altered for any purpose.
 * This source code is to be used exclusively by users and customers of Sematext.
 * Please see the full license (found in LICENSE in this distribution) for details on its license and the licenses of its dependencies.
 */
'use strict'
var yaml = require('js-yaml')
var fs = require('fs')
var moment = require('moment')
var crypto = require('crypto')
var MultiLine = require('./multiLine.js')
var geoip = null 
var initJobs = []


function LogParser (fileName, options, readyCallback) {
  this.ready = false
  this.readyCallback = readyCallback
  this.options = options
  this.sources = {}
  this.load(fileName || require('path').join(__dirname, '../patterns.yml'), options)
}
function initGeoIp (err, fileName) {
  if (err) {
    this.cfg.geoIPEnabled = false
    if(this.readyCallback) {
      this.readyCallback()
      this.readyCallback = null
    }
    return
  }
  if (fs.existsSync(fileName))
  {
    geoip.init(fileName, {indexCache: true, checkForUpdates: true}) 
    this.cfg.geoIPEnabled = true
    if (this.cfg.globalTransform)
    {
      this.cfg.globalTransform = this.cfg.globalTransform.bind({
        moment: moment, 
        geoip: geoip,
        enrichGeoIp: this.enrichGeoIp
      })
    }
  } else {
    this.cfg.geoIPEnabled = false
  }
  if(this.readyCallback) {
    this.readyCallback()
    this.readyCallback = null
  }
}
LogParser.prototype = {
  
  load: function (name, options) {
    try {
      this.cfg = yaml.load(fs.readFileSync(name, 'utf8'))
      if (this.cfg.autohash) {
        console.log('Hashing field content enabled for field names: ' + this.cfg.autohash)
      }
      // console.log(this.cfg)
      this.patterns = this.cfg.patterns
      if (options && options.whitelist) {
        this.whitelist(options.whitelist)
      }
      if (options && options.blacklist) {
        this.blacklist(options.blacklist)
      }
      // inject modules to global transform function
      
      if (this.cfg.geoIP && !(process.env.GEOIP_DISABLED=='true')) {
        var fileName = (process.env.MAXMIND_DB_DIR || this.cfg.maxmindDbDir) + 'GeoIPCity.dat'
        var cbInitGeoIp = null
        try {
          geoip = require('maxmind')
          if (fs.existsSync(fileName))
          {
            initGeoIp.bind(this)(null, fileName)
            cbInitGeoIp = null
          } else {
            cbInitGeoIp = initGeoIp.bind(this)
          }
          var maxmindUpdate=require('./maxmind-update')
          this.maxmindUpdate =  maxmindUpdate(this.cfg.debug, 
            (process.env.MAXMIND_DB_DIR || this.cfg.maxmindDbDir), 
            cbInitGeoIp) 
        } catch (err) {
          console.log(err.stack)
          if(this.readyCallback) {
            setTimeout (this.readyCallback, 0)
          }
        }
      } else {
        if (this.readyCallback)
          this.readyCallback()
      }
    } catch (e) {
      if (e.reason && e.mark) {
        console.log('Error parsing file: ' + name + ' ' + e.reason + ' line:' + e.mark.line + ' column:' + e.mark.columns)
      } else {
        console.log('Error parsing file: ' + name + ' ' + e)
      }
      this.patterns = []
      process.exit()
    } finally {
      return this.patterns
    }
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
    if (!this.cfg.geoIPEnabled || !fieldName)
        return null
    if (parsedObject[fieldName]) {
      var location = geoip.getLocation(parsedObject[fieldName])
      if (location) {
        parsedObject['geoip'] = {location: [location.longitude, location.latitude], info: location} 
      }
    }
  },
  getPatternsForSource: function (sourceName) {
    if (!sourceName) {
      return this.patterns // try all
    }
    var src = this.sources[sourceName]
    if (src && src.patterns) {
      return this.sources[sourceName].patterns
    }
    var exclude = []
    var include = this.patterns.filter(function (p) {
      if (sourceName && sourceName.match && sourceName.match(p.sourceName)) {
        return true
      } else {
        exclude.push(p)
      }
    })
    var patternLists = include.concat(exclude)
    // console.log('Patterns for source ' + sourceName + ' : ex:' + exclude.length + ' incl:' + include.length)
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
      var include = this.patterns.filter(function (p) {
        if (sourceName && sourceName.match && sourceName.match(p.sourceName)) {
          return true
        }
      })
      if (include.length > 0) {
        this.sources[sourceName].reader = new MultiLine(include[0].blockStart, parser)
        return this.sources[sourceName].reader
      } else {
        this.sources[sourceName].reader = new MultiLine(/^\S+/, parser)
        return this.sources[sourceName].reader
      }
    }
  },
  hash: function hash (input) {
    var sha1 = crypto.createHash('sha1')
    sha1.update(input.toString())
    return sha1.digest('hex')
  },
  parseDate: function (strDate, dateFormat) {
    var d = null
    if (dateFormat) {
      d = moment(strDate.trim().replace('  ', ' '), dateFormat.trim(), true) || moment(strDate.trim().replace('  ', ' '), this.cfg.dateFormats, true)
    }
    if (d && d.isValid()) {
      return d.toDate()
    } else {
      // console.log('DATE not matched' + strDate + ' ' + dateFormat)
      return null
    }
  },
  matchPatterns: function (p, parsed, line) {
    var match = line.match(p.regex)
    if (match) {
      parsed._type = p.type
      if (p.fields && (match.length > p.fields.length)) {
        for (var i = 0; i < p.fields.length; i++) {
          var value = match[i + 1]
          if (!isNaN(value) && value !== '') {
            value = Number(value)
          }
          if (this.cfg.autohash && this.cfg.autohash.test(p.fields[i])) {
            value = this.hash(value)
          }
          parsed[p.fields[i]] = value
          if(p.fields[i] == p.geoIP) {
            this.enrichGeoIp(parsed, p.geoIP)
          }
        }
        if (parsed['ts']) {
          var timestamp = this.parseDate(parsed['ts'], p.dateFormat)
          if (timestamp) {
            parsed['@timestamp'] = timestamp
          }
        }
        if (p.transform) {
          try {
            p.transform(parsed)
          } catch (ex) {
            console.log('Error in' + p.type + '.transform():' + ex)
          }
        }
        this.enrichGeoIp (p, p.geoIP)
        // remove ts field, because Elasticsearch
        // might have problems to index it
        // it could be recognized as string or data
        // depending on its content
        delete parsed.ts
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
  parseLine: function (line, source, cbf) {
    var br = this.getMultiLineReader(source, function (data) {
        this._parseLine(data, source, cbf)
    }.bind(this))
    br.add(line)
  },
  globalTransform: function (source, parsed) {
    if (this.cfg.globalTransform) {
      try {
        this.cfg.globalTransform(source, parsed)
      } catch (ex) {
        console.error('Error in gloabalTransform():' + ex)
      }
    } 
  }, 
  _parseLine: function (line, source, cbf) {
    if (line === null || line === '') {
      cbf('empty', null)
    }
    var parsed = {}
    if (this.cfg.originalLine === true)
    {
      parsed.originalLine = line 
    }
    parsed['@source'] = source
    // JSON handling
    var trimedLine=line.trim()
    if (/^{/.test(trimedLine)) {
      try {
        parsed = JSON.parse(trimedLine)
        if (!(parsed['@timestamp'])) {
          if (parsed.time && parsed.time instanceof Date) {
            parsed['@timestamp'] = parsed.time
          } else if (parsed.t && parsed.t instanceof Date) {
            parsed['@timestamp'] = parsed.t
          } else if (parsed.timestamp && parsed.task_uuid) {
              // python eliot logs
              parsed['@timestamp'] = new Date(parsed.timestamp*1000)
          }else {
            parsed['@timestamp'] = new Date()
          }
        }
        if (!parsed.message && parsed.msg) {
          parsed.message = parsed.msg
        }
        // TODO JSON GeoIP enrichment
        this.globalTransform(source, parsed)
        return cbf(null, parsed)
      } catch (ex) {
        // ignore treat as text
      }
    }
    var patternList = this.getPatternsForSource(source) || this.patterns
    for (var k in patternList) {
      var patterns = patternList[k]
      for (var i = 0; i < patterns.match.length; i++) {
        if (this.matchPatterns(patterns.match[i], parsed, line)) {
          this.bubbleUp(patternList, k)
          if (!parsed._type) {
            parsed._type = patternList[k].type
          }
          if (this.gloabalTransform) {
            this.globalTransform(source, parsed)
          }
          return cbf(null, parsed)
        }
      }
    }
    return cbf('not found', {'@timestamp': new Date(), message: line, '@source': source}
    )
  }
}

module.exports = LogParser
