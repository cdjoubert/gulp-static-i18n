'use strict';

var fs = require('fs');
var gutil = require('gulp-util');
var lodash = require('lodash');
var through = require('through2');
var gettextParser = require('gettext-parser');

var PluginError = gutil.PluginError;

var TOKEN_REGEX = {
  'javascript': /gettext\(\s*(?:"([^"]+)"|\'([^\']+)\')\s*\)\s*/g,
  'handlebars': /todo/
};
var BOOKENDS = {
  'javascript': '\''
};

function Translator(options) {
  this.options = lodash.defaults(options, {
      localeDir: 'locale'
  });
  return this;
}


Translator.prototype.getLocales = function() {
  if (this._locales && this._locales.length > 0) {
    return this._locales;
  }

  var localeDir = this.options.localeDir;
  var isLocale = function(file) {
    var filePath = localeDir + '/' + file;
    return (! file.match(/template/)) && fs.statSync(filePath).isDirectory();
  };
  this._locales = lodash.filter(fs.readdirSync(localeDir), isLocale);
  return this._locales;
};


Translator.prototype.getCatalogs = function() {
  if(this._catalogs) {
    return this._catalogs;
  }

  var parseMessages = function(lang) {
    var fp = this.options.localeDir + '/' + lang + '/LC_MESSAGES/messages.po';
    var po = fs.readFileSync(fp, {encoding: 'utf8'});
    return gettextParser.po.parse(po).translations[''];
  };
  var locales = this.getLocales();
  var catalogList = lodash.map(locales, parseMessages, this);

  this._catalogs = lodash.zipObject(locales, catalogList);
  return this._catalogs;
};


Translator.prototype.getCatalog = function(lang) {
  var catalogs = this.getCatalogs();
  var cat = catalogs[lang];
  if (!cat) {
    this.error('Unable find a translation catalog for ' + lang);
  }
  return cat;
};


Translator.prototype.langGettext = function(lang, str) {
  if (!str) {
    this.error('Unable to translate ' + str);
  }
  var catalog = this.getCatalog(lang);
  var msg = catalog[str] || {};
  return (msg.msgstr && msg.msgstr[0]) || str;
};


Translator.prototype.error = function(msg) {
  var id = 'gulp-static-i18n/lib/Translator';
  if (this.stream) {
    this.stream.emit('error', new PluginError(id, msg));
  } else {
    throw new Error(msg);
  }
};


Translator.prototype.getTokenRegex = function(type) {
  var re = TOKEN_REGEX[type];
  if (!re) {
    this.error('File type not supported: ' + type);
  }
  // Regexs are not immuteable, when exec'd they update internal indexes.
  // Returning a copy prevents the constant from being contaminated.
  return new RegExp(re);
};


Translator.prototype.translateCopy = function(copy, lang, re, bookend) {
  var gettext = lodash.bind(this.langGettext, this, lang);
  var translated = copy;
  var find = new RegExp(re);
  var match = find.exec(copy);
  var msgid, needle, replacement;
  while (match) {
    needle = match[0];
    msgid = match[1] || match[2];
    replacement = bookend + gettext(msgid) + bookend;
    translated = translated.replace(needle, replacement);
    match = find.exec(copy);
  }
  return translated;
};


Translator.prototype.translate = function(file, type) {
  var copy = file.contents.toString('utf-8');
  var re = this.getTokenRegex(type);
  var bookend = BOOKENDS[type] || '';
  var lang, translated;
  var locales = this.getLocales();
  for (var i = 0; i < locales.length; i++) {
    lang = locales[i];
    translated = this.translateCopy(copy, lang, re, bookend);
    this.stream.emit('translation', {lang: lang, translation: translated});
  }
  this.stream.resume();
};


Translator.prototype.getStreamTranslator = function(fileType) {
  var translator = this;
  return through.obj(function(file, encoding, cb) {
    translator.stream = this;
    translator.translate(file, fileType);
    cb(null, file);
  });
};


module.exports = Translator;