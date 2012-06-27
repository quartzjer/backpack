var idr = require('./idr');
var path = require('path');
var urllib = require('url');

// convert an entry into csv, only first level
exports.csvize = function(entries, opt)
{
  if(!opt) opt = {};
  if(!opt.delim) opt.delim = ',';
  if(opt.delim == 'tab') opt.delim = '\t'; // easier
  if(!opt.eol) opt.eol = '\n';
  if(!opt.simple) opt.simple = true; // uses oembed only
  if(!opt.header) opt.header = true;
  var fields = {};
  var rows = [];
  var seen = {};
  var urls = {};
  entries.forEach(function(entry){
    if(opt.simple && !entry.oembed) return;
    if(seen[entry.id]) return;
    seen[entry.id] = true; // skip 100% dups
    var r = idr.parse(entry.idr);
    var type = r.host+'_'+r.protocol;
    if(opt.simple) type = 'oembed_'+entry.oembed.type;
    var row = fielder(type, (opt.simple) ? entry.oembed : entry.data);
    row._at = (new Date(entry.at)).toString();
    row._id = entry.id;
    row._service = r.host;
    Object.keys(row).forEach(function(field){ fields[field] = true }); // make sure we have all possible fields
    rows.push(row);
    // hack for photos!
    if(entry.oembed && entry.oembed.url){
      var url = urllib.parse(entry.oembed.url);
      urls[r.host+'/'+entry.id+'_'+path.basename(url.pathname)] = entry.oembed.url;
    }
  });
  
  var ret = "";
  var fields = Object.keys(fields); // flatten
  if(opt.header) ret += fields.join(opt.delim) + opt.eol;
  rows.forEach(function(row){
    ret += fields.map(function(field){
      if(!row[field] || typeof row[field] == 'object') return "";
      if(typeof row[field] == 'string') return row[field].split(opt.delim).join(" ").replace(/\s+/g, " ");
      return row[field].toString();
    }).join(opt.delim) + opt.eol;
  });
  return {raw:ret, urls:urls};
}

// use optional custom remapping to turn any data into a flat key-value object
function fielder(type, data)
{
  var ret = {};
  var map = exports[type] || {};
  Object.keys(data).forEach(function(key){
    // function return whole objects
    if(typeof map[key] === 'function'){
      var x = map[key](data);
      if(x) Object.keys(x).forEach(function(xk){ ret[xk] = x[xk] })
      return;
    };
    if(map._ignore && map._ignore.indexOf(key) >= 0) return;
    key = map[key] || key;
    if(data[key]) ret[key] = data[key];
  });
  if(map._also) {
    var x = map._also(data);
    if(x) Object.keys(x).forEach(function(xk){ ret[xk] = x[xk] })    
  }
  return ret;
}

exports.oembed_contact = {
  'title':function(data){ return {name:data.title} },
  'description':function(data){ return {bio:data.description} },
  'thumbnail_url':function(data){ return {image:data.thumbnail_url} },
  '_ignore': ['type']
}

exports.oembed_checkin = {
  'title':function(data){ return {place:data.title} },
  'description':function(data){ return {text:data.description} },
  'thumbnail_url':function(data){ return {image:data.thumbnail_url} },
  '_ignore': ['type']
}

exports.oembed_link = {
  '_ignore': ['type', 'provider_url', 'err', 'version', 'html', 'thumbnail_width', 'thumbnail_height']
}

exports.oembed_photo = {
  '_ignore': ['type', 'provider_url', 'err', 'version', 'html', 'thumbnail_width', 'thumbnail_height']
}

exports.oembed_video = {
  '_ignore': ['type', 'provider_url', 'err', 'version', 'html', 'thumbnail_width', 'thumbnail_height', 'height', 'width']
}

exports.twitter_tweet = {
  '_also': function(data)
  {
    var ret = {};
    ret.screen_name = data.user.screen_name;
    return ret;
  },
  'id':'id_str',
  '_ignore': ['id_str']
}