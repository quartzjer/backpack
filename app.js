// USAGE: node app.js <clientID> <clientSecret> [exampleHost] [apiHost]

var express = require('express');
var querystring = require('querystring');
var request = require('request');
var sprintf = require('sprintf').sprintf;
var async = require('async');

// The port that this express app will listen on
var port = process.env.port || 8442;

// Your client ID and secret from http://dev.singly.com/apps
var clientId = process.env["OAUTH_CLIENT_ID"] || process.argv[2] || '';
var clientSecret = process.env["OAUTH_CLIENT_SECRET"] || process.argv[3] || '';

var hostBaseUrl = process.argv[4] || 'http://localhost:' + port;
var apiBaseUrl = process.argv[5] || 'https://api.singly.com';

// Pick a secret to secure your session storage
var sessionSecret = '42';

// Create an HTTP server
var app = express.createServer();

// Setup for the express web framework
app.configure(function() {
  app.use(express.logger());
  app.use(express.static(__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: sessionSecret
  }));
  app.use(app.router);
});

// We want exceptions and stracktraces in development
app.configure('development', function() {
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
});

// ... but not in production
app.configure('production', function() {
  app.use(express.errorHandler());
});

app.get("/reset", function(req, res) {
  res.cookie("token", "");
  res.redirect("/");
});

app.get('/callback', function(req, res) {
  var data = {
    client_id: clientId,
  client_secret: clientSecret,
  code: req.param('code')
  };

  // Exchange the OAuth2 code for an access_token
  request.post({
    uri: sprintf('%s/oauth/access_token', apiBaseUrl),
    body: querystring.stringify(data),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, function (err, resp, body) {
    try {
      body = JSON.parse(body);
    } catch(parseErr) {
      return res.send(parseErr, 500);
    }

    console.log("%j", body);
    // Save the access_token for future API requests
    req.session.access_token = body.access_token;

    // Fetch the user's service profile data
    request.get({uri:apiBaseUrl+'/profiles?access_token='+body.access_token, json:true}, function(err, resp, profilesBody) {
      if(err || !profilesBody) return res.send(err, 500);

      req.session.profiles = profilesBody;
      res.cookie("token", body.access_token);
      res.redirect('/');
    });
  });
});

var pack_csv = require("./pack_csv");
var zip = require("node-native-zip");

app.get('/csv', function(req, res) {
  var type = req.query.type;
  var token = req.query.token;
  if(!type || !token) return res.send("missing type/token :(", 500);
  request.get({uri:apiBaseUrl+'/types/'+type+'?min_count=10000&access_token='+token, json:true}, function(err, resp, entries) {
    if(err) return res.send(err, 500);
    if(!entries || entries.length == 0) return res.send("no entries", 500);
    var csv = pack_csv.csvize(entries, req.query);
    if(req.query.zip)
    {
      var z = new zip();
      z.add(type+".csv", new Buffer(csv.raw));
      if(type!='photos' || !req.query.download)
      {
        res.writeHead(200, {'Content-Type': 'application/zip'});
        res.end(z.toBuffer(), 'binary');
        return;
      }
      async.forEach(Object.keys(csv.urls), function(key, cb){
        console.log("fetching ",key,csv.urls[key]);
        request.get({url:csv.urls[key]}, function(e,r,dat){
          z.add(key, dat);
          cb();
        });
      }, function(){
        res.writeHead(200, {'Content-Type': 'application/zip'});
        res.end(z.toBuffer(), 'binary');        
      });
    }else{
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(csv.raw);
    }
  });
});

app.listen(port);

console.log(sprintf('Listening at %s using API endpoint %s.', hostBaseUrl, apiBaseUrl));
