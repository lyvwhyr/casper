/*
	Copyright 2015, Google, Inc. 
 Licensed under the Apache License, Version 2.0 (the "License"); 
 you may not use this file except in compliance with the License. 
 You may obtain a copy of the License at 
  
    http://www.apache.org/licenses/LICENSE-2.0 
  
 Unless required by applicable law or agreed to in writing, software 
 distributed under the License is distributed on an "AS IS" BASIS, 
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
 See the License for the specific language governing permissions and 
 limitations under the License.
*/
"use strict";

var path = require('path');
var express = require('express');
var session = require('cookie-session');
var gcloud = require('gcloud');
var config = require('./config');
var logging = require('./lib/logging')(config.logPath);


var app = express();

app.disable('etag');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('trust proxy', true);


/*
  Add the request logger before anything else so that it can
  accurately log requests.
*/
app.use(logging.requestLogger);


/*
  Configure the session and session storage.
  MemoryStore isn't viable in a multi-server configuration, so we
  use encrypted cookies. Redis or Memcache is a great option for
  more secure sessions, if desired.
*/
app.use(session({
  secret: config.secret,
  signed: true
}));


app.use(express.static(path.join(__dirname, 'public')));

/* Include the app engine handlers to respond to start, stop, and health checks. */
app.use(require('./lib/appengine-handlers'));


/* OAuth2 */
var oauth2 = require('./lib/oauth2')(config.oauth2);

app.use(oauth2.router);




/* Books */
var background = require('./lib/background')(config.gcloud, logging);
var images = require('./lib/images')(config.gcloud, config.cloudStorageBucket, logging);
var model = require('./books/model-' + config.dataBackend)(config, background);

app.use('/books', require('./books/crud')(model, images, oauth2));
app.use('/api/books', require('./books/api')(model));



/* Redirect root to /books */
app.get('/', function(req, res) {
  res.redirect('/books');
});


/*
  Add the error logger after all middleware and routes so that
  it can log errors from the whole application. Any custom error
  handlers should go after this.
*/
app.use(logging.errorLogger);


/* Start the server */
var server = app.listen(config.port, '0.0.0.0', function() {
  console.log('App listening at http://%s:%s', server.address().address, server.address().port);
  console.log("Press Ctrl+C to quit.");
});
