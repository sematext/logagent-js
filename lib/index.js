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

function LogParser (fileName, options) {
  this.load(fileName, options)
  this.options = options
  this.sources = {}
}

LogParser.prototype = {
  load: function (name, options) {
    try {
      this.cfg = yaml.load(fs.readFileSync(name, 'utf8'))
      // console.log(this.cfg)
      this.patterns = this.cfg.patterns
      if (options && options.whitelist) {
        this.whitelist(options.whitelist)
      }
      if (options && options.blacklist) {
        this.blacklist(options.blacklist)
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
  getPatternsForSource: function (sourceName) {
    if (!sourceName) {
      return this.patterns // try all
    }
    if (this.sources [sourceName]) {
      return this.sources [sourceName]
    }
    var exclude = []
    var include = this.patterns.filter(function (p) {
      if (sourceName.match(p.sourceName)) {
        return true
      } else {
        exclude.push(p)
      }
    })
    var patternLists = include.concat(exclude)
    console.log('Patterns for source ' + sourceName + ' : ex:' + exclude.length + ' incl:' + include.length)
    this.sources [sourceName] = patternLists
  },
  parseDate: function (strDate, dateFormat) {
    var d = null
    if (dateFormat) {
      d = moment(strDate.trim(), dateFormat.trim(), true) || moment(strDate, this.cfg.dateFormats, true)
    }
    if (d) {
      return d.toDate()
    } else {
      // console.log('DATE noat matched' + strDate + ' ' + dateFormat)
      return null
    }
  },
  matchPatterns: function (p, parsed, line) {
    var match = line.match(p.regex)
    if (match) {
      parsed._type = p.type
      if (p.fields && (match.length > p.fields.length)) {
        for (var i = 0; i < p.fields.length; i++) {
          var value = match [i + 1]
          if (!isNaN(value)) {
            value = Number(value)
          }
          parsed[p.fields[i]] = value
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
    if (line === null || line === '') {
      cbf('empty', null)
    }
    var parsed = {}
    var self = this
    var patternList = self.getPatternsForSource(source) || this.patterns
    for (var k in patternList) {
      var patterns = patternList[k]
      for (var i = 0; i < patterns.match.length; i++) {
        if (self.matchPatterns(patterns.match[i], parsed, line)) {
           self.bubbleUp(patternList, k)
          return cbf(null, parsed)
        }
      }
    }
    return cbf('not found', {'@timestamp': new Date(), message: line}
    )
  }
}

module.exports = LogParser
