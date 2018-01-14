const $fh = require('fh-mbaas-api');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const SERVICE_NAME = 'chef-app-service';
const SERVICE_VERSION = 'v0.0.1';

var host = process.env.TRACING_SERVICE_NAME || 'localhost';
// The agent exposes the following ports: 5775/udp 6831/udp 6832/udp 5778.
var port = process.env.TRACING_SERVICE_PORT || 6832;

const { Tags, FORMAT_HTTP_HEADERS } = require('opentracing');
const jaeger = require('jaeger-client');
var initTracer = require('jaeger-client').initTracer;

const FLUSH_INTERVAL = 500;

// See schema https://github.com/jaegertracing/jaeger-client-node/blob/master/src/configuration.js#L37
const config = {
  serviceName: SERVICE_NAME,
  sampler: {
    type: 'const',
    param: 1,
    host: host,
    port: port,
    refreshIntervalMs: FLUSH_INTERVAL,
  },
  reporter: {
    flushIntervalMs: FLUSH_INTERVAL,
    agentHost: host,
    agentPort: port,
  },
};

const options = {};

const tracer = jaeger.initTracer(config, options);
console.log('tracer', tracer);

const crypto = require('crypto');
const canonicalize = require('fast-json-stable-stringify');

const request = require('request-promise')

const db = require('./db-store');

const DYNAMIC_SERVICE_MOCKED_UP = process.env.DYNAMIC_SERVICE_MOCKED_UP || "true";

function _invokeServiceMockUp (carrier, service, path, method, data) {
  console.log('service', service, 'method:', method, 'data:', JSON.stringify(data));

  const filter =  { 
    eq : { 
      hash : crypto.createHash('md5').update(canonicalize(data)).digest("hex")
    } 
  };

  if (typeof service !== 'undefined' && typeof method !== 'undefined' && typeof data !== 'undefined' ) {
    return new Promise(function(resolve, reject) {
      db.list(service, filter, function (err, data) {
        if (err) {
          reject({result:'ERROR', msg: err});
        } else {
          resolve(data);
        }
      });
    });
  }
  return new Promise(function (resolve, reject) {
    reject({result:'ERROR', msg: 'WRONG_DATA'});
  });
}

function _invokeService(carrier, service, path, method, data) {
  console.log('service:', service, 'path:', path, 'method:', method, 'data:', JSON.stringify(data));

  const serviceURI = 'http://' + service + ':8080/' + path;

  if (typeof service !== 'undefined' && typeof method !== 'undefined' && typeof data !== 'undefined' ) {
    var options = {
      method: method,
      uri: serviceURI,
      json: true,
      headers: carrier
    };
    if (method === 'GET') {
      options.qs = data;
    } else if (method === 'POST') {
      options.body = data;
    }

    return request(options);
  }
  return new Promise(function (resolve, reject) {
    reject({result:'ERROR', msg: 'WRONG_DATA'});
  });
}

function adapt (data) {
  return new Promise(function(resolve, reject) {
    if (data && data.constructor === Array)  {
      var _data = data.map(function (element) {
        if (element) {
          return {
            type: element.type,
            firstName: element.fn,
            lastName: element.ln,
            email: element.email,
            department: element.ou,
            source: element.source
          };
        }
      });
      resolve(_data);
    } else {
      reject({result:'ERROR', msg: 'Data returned not an Array', data: JSON.stringify(data)});
    }
  });
}

function invokeService(carrier, service, path, method, data) {
  console.log('DYNAMIC_SERVICE_MOCKED_UP', DYNAMIC_SERVICE_MOCKED_UP);
  if (DYNAMIC_SERVICE_MOCKED_UP === 'true') {
    console.log('_invokeServiceMockedUp');
    return _invokeServiceMockUp(carrier, service, path, method, data);
  } else {
    console.log('_invokeService');
    return _invokeService(carrier, service, path, method, data);
  }
}

function route() {
  var router = new express.Router();
  router.use(cors());
  router.use(bodyParser());


  router.all('/:service/:path*?', function(req, res) {
    const service = req.params.service;
    const method = req.method;
    const path = req.params.path;
    console.log('path', path);

    // Parent context?
    const parentSpanContext = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
    const span = tracer.startSpan('service-' + service, {
      childOf: parentSpanContext
    });
    // Generate carrier for invoking the next service...
    var carrier = {};
    tracer.inject(span.context(), FORMAT_HTTP_HEADERS, carrier)

    var data = {};
    if (method === 'GET') {
      data = req.query;
    } else if (method === 'POST') {
      data = req.body;
    }

    invokeService(carrier, service, path, method, data)
    //.then(function (data) {
    //  return adapt(data);
    //})
    .then(function (data) {
      span.finish();
      res.status(200).json(data);
    })
    .catch(function (err) {
      span.setTag(Tags.ERROR, true);
      span.log({'event': 'error', 'error.object': err, 'message': err});
      span.finish();
      res.status(500).json({result:'ERROR', msg: err})
    });
  });

  return router;
}

module.exports = route;
