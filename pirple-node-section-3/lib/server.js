// Server related tasks

// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const stringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const utils = require('util');
const debug = utils.debuglog('server');
const { colorizeLog } = require('../helpers/helpers');

// Instantiate a server module object
const server = {
  httpsServerOptions: {
    key: fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '/../https/cert.pem')),
  },

  // Instantiate the http server
  httpServer: http.createServer((req, res) => {
    server.unifiedServer(req, res);
  }),

  // Instantiate the https server
  httpsServer: https.createServer(this.httpsServerOptions, (req, res) => {
    server.unifiedServer(req, res);
  }),

  init() {
    // Start both http and https servers
    // HTTP
    this.httpServer.listen(config.httpPort, () => {
      console.log(colorizeLog([36, 0], `Server is listening on port ${config.httpPort}`));
    });

    // HTTPS
    this.httpsServer.listen(config.httpsPort, () => {
      console.log(colorizeLog([35, 0], `Server is listening on port ${config.httpsPort}`));
    });
  },

  // Define a request router
  router: {
    ping: handlers.ping,
    users: handlers.users,
    tokens: handlers.tokens,
    checks: handlers.checks,
  },

  // All the server logic for http and https servers
  unifiedServer(req, res) {
    // Get the URL and parse it
    const { pathname, query } = url.parse(req.url, true);

    // Get the path
    const trimmedPath = pathname.replace(/^\/+|\/+$/g, '');

    // Get the query string as an object
    const queryStringObject = query;

    // Get the HTTP Method
    const method = req.method.toLowerCase();

    // Get the header as an object
    const headers = req.headers;

    // Get the payload, if any
    const decoder = new stringDecoder('utf-8');
    let buffer = '';
    req.on('data', data => (buffer += decoder.write(data)));

    req.on('end', () => {
      buffer += decoder.end();

      // Choose the handler the request should go to
      const chosenHandler = this.router[trimmedPath] ?? handlers.notFound;
      // Construct the data object to send to the handler
      const data = {
        trimmedPath,
        queryStringObject,
        method,
        headers,
        payload: helpers.parseJsonToObject(buffer),
      };

      // Route the request to the handler specified in the router
      chosenHandler(data, (statusCode = 200, payload = {}) => {
        const payloadString = JSON.stringify(payload);
        // Return the response
        res.setHeader('Content-type', 'application/json');
        res.writeHead(statusCode);
        res.end(payloadString);

        // If the response is 200 print green, otherwise print red
        const { colorCodes, text } = {
          colorCodes: statusCode === 200 ? [32, 0] : [31, 0],
          text: `${method.toUpperCase()} /${trimmedPath} ${statusCode}`,
        };
        debug(colorizeLog(colorCodes, text));
      });
    });
  },
};

// Export the module
module.exports = server;
