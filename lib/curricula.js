var $fh = require('fh-mbaas-api');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');

var db = require('./db-store');

var CURRICULA_SERVICE_GUID = process.env.CURRICULA_SERVICE_GUID;
var CURRICULA_COLLECTION_NAME = process.env.CURRICULA_COLLECTION_NAME || "curricula";
var CURRICULA_SERVICE_MOCKED_UP = process.env.URRICULA_SERVICE_MOCKED_UP || "true";

function _searchCurriculaMockedUp (filter) {
  return new Promise(function(resolve, reject) {
    db.list(CURRICULA_COLLECTION_NAME, filter, function (err, data) {
      if (err) {
        reject({result:'ERROR', msg: err});
      } else {
        resolve(data);
      }
    });
  });
}

function _searchCurricula(filter) {
  return new Promise(function(resolve, reject) {
    var path = '/curricula';
    console.log('path: ' + path);

    $fh.service({
      "guid" : CURRICULA_SERVICE_GUID, // The 24 character unique id of the service
      "path": path, //the path part of the url excluding the hostname - this will be added automatically
      "method": "POST",   //all other HTTP methods are supported as well. e.g. HEAD, DELETE, OPTIONS
      "timeout": 25000, // timeout value specified in milliseconds. Default: 60000 (60s)
      "params": filter,
      //"headers" : {
        // Custom headers to add to the request. These will be appended to the default headers.
      //}
    }, function(err, body, response) {
      console.log('statuscode: ', response && response.statusCode);
      if (err) {
        // An error occurred during the call to the service. log some debugging information
        console.log(path + ' service call failed - err : ', err);
        reject({result:'ERROR', msg: err});
      } else {
        resolve(body);
      }
    });
  });
}

function searchCurricula(filter) {
  console.log('CURRICULA_SERVICE_MOCKED_UP', CURRICULA_SERVICE_MOCKED_UP);
  if (CURRICULA_SERVICE_MOCKED_UP === 'true') {
    console.log('_searchCurriculaMockedUp');
    return _searchCurriculaMockedUp(filter);
  } else {
    console.log('_searchCurricula');
    return _searchCurricula(filter);
  }
}

/*

{
  "like": {
    "firstName": "PACO"
   }
}

{
  "eq": {
    "cid": "0001"
   }
}

*/

function route() {
  var router = new express.Router();
  router.use(cors());
  router.use(bodyParser.json());
  router.use(bodyParser.urlencoded({ extended: true }));

  router.get('/', function(req, res) {
    var id = req.query.id;
    console.log('id ' + id);
    if (typeof id === 'undefined' || id === '') {
      res.status(404).json([]);
      return;
    }
    db.read(CURRICULA_COLLECTION_NAME, id, function (err, data) {
      if (err) {
        res.status(500).json({result:'ERROR', msg: err})
      } else {
        res.status(200).json(data);
      }
    });
  });

  router.post('/', function(req, res) {
    var filter = req.body;
    console.log('filter: ' + filter);
    if (typeof filter === 'undefined') {
      res.status(404).json([]);
      return;
    }

    searchCurricula(filter).
    then(function (data) {
      res.status(200).json(data);
    })
    .catch(function (err) {
      res.status(500).json({result:'ERROR', msg: err})
    });
  });

  return router;
}

module.exports = route;
