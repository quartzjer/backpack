var idr = require('./idr');

// convert an entry into csv, only first level
exports.csvize = function(entries, opt)
{
  if(!opt) opt = {};
  if(!opt.delim) opt.delim = ',';
  if(!opt.eol) opt.eol = '\n';
  if(!opt.simple) opt.simple = true; // uses oembed only
  if(!opt.header) opt.header = true;
  var fields = {};
  var rows = [];
  entries.forEach(function(entry){
    if(opt.simple && !entry.oembed) return;
    var r = idr.parse(entry.idr);
    var type = r.host+'_'+r.protocol;
    if(opt.simple) type = 'oembed_'+entry.oembed.type;
    var row = fielder(type, (opt.simple) ? entry.oembed : entry.data);
    row.at = (new Date(entry.at)).toString();
    Object.keys(row).forEach(function(field){ fields[field] = true }); // make sure we have all possible fields
    rows.push(row);
  });
  
  var ret = "";
  var fields = Object.keys(fields); // flatten
  if(opt.header) ret += fields.join(opt.delim) + opt.eol;
  rows.forEach(function(row){
    fields.map(function(field){ return row[field]||"" }).join(opt.delim) + opt.eol;
  });
  return ret;
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
      if(x) Object.keys(x).forEach(function(xk){ ret[xk] = x[k] })
      return;
    };
    if(map._ignore && map._ignore.indexOf(key) >= 0) return;
    key = map[key] || key;
    if(data[key]) ret[key] = data[key];
  });
  if(map._also) {
    var x = map._also(data);
    if(x) Object.keys(x).forEach(function(xk){ ret[xk] = x[k] })    
  }
  return ret;
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