var $fh = require('fh-mbaas-api');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');

var db = require('./db-store');

var EVENTS_SERVICE_GUID = process.env.EVENTS_SERVICE_GUID;
var EVENTS_COLLECTION_NAME = process.env.EVENTS_COLLECTION_NAME || "events";
var EVENTS_SERVICE_MOCKED_UP = process.env.EVENTS_SERVICE_MOCKED_UP || "true";

function _searchEventsMockedUp (filter) {
  return new Promise(function(resolve, reject) {
    db.list(EVENTS_COLLECTION_NAME, filter, function (err, data) {
      if (err) {
        reject({result:'ERROR', msg: err});
      } else {
        resolve(data);
      }
    });
  });
}

function _searchEvents(filter) {
  return new Promise(function(resolve, reject) {
    var path = '/events';
    console.log('path: ' + path);

    $fh.service({
      "guid" : EVENTS_SERVICE_GUID, // The 24 character unique id of the service
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

function searchEvents(filter) {
  console.log('EVENTS_SERVICE_MOCKED_UP', EVENTS_SERVICE_MOCKED_UP);
  if (EVENTS_SERVICE_MOCKED_UP === 'true') {
    console.log('_searchEventsMockedUp');
    return _searchEventsMockedUp(filter);
  } else {
    console.log('_searchEvents');
    return _searchEvents(filter);
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
    db.read(EVENTS_COLLECTION_NAME, id, function (err, data) {
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

    searchEvents(filter).
    then(function (data) {
      res.status(200).json(data);
    })
    .catch(function (err) {
      res.status(500).json({result:'ERROR', msg: err})
    });
  });

  router.get('/:country/:city', function(req, res) {
    var country = req.params.country;
    var city = req.params.city;
    console.log('Find event by country', country, 'city', city);
    if (typeof country === 'undefined' || country == '' ||
        typeof city === 'undefined' || city == '') {
      res.status(400).json([]);
    }
    /**
     * Finding an event by country, city, ...
     */
    var now = new Date();
    var isoDate = now.getFullYear() + "-" + ('0' + (now.getMonth() + 1)).slice(-2) + "-" + ('0' + now.getDate()).slice(-2);
    console.log('events.list dates >>>> ',isoDate);
    var filter = {
      "eq": {
        "country": country,
        "city": city,
        "date": isoDate
      }
    };
    searchEvents(filter).
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
