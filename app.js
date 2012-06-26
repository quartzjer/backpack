// USAGE: node app.js <clientID> <clientSecret> [exampleHost] [apiHost]

var express = require('express');
var querystring = require('querystring');
var request = require('request');
var sprintf = require('sprintf').sprintf;

// The port that this express app will listen on
var port = 8442;

// Your client ID and secret from http://dev.singly.com/apps
var clientId = process.argv[2] || '';
var clientSecret = process.argv[3] || '';

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

app.listen(port);

console.log(sprintf('Listening at %s using API endpoint %s.', hostBaseUrl, apiBaseUrl));
