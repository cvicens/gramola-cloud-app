var $fh = require('fh-mbaas-api');
var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');

var db = require('./db-store');

var RECIPES_SERVICE_GUID = process.env.RECIPES_SERVICE_GUID;
var RECIPES_COLLECTION_NAME = process.env.RECIPES_COLLECTION_NAME || "recipes";
var RECIPES_SERVICE_MOCKED_UP = process.env.RECIPES_SERVICE_MOCKED_UP || "true";

function _searchRecipesMockedUp (filter) {
  return new Promise(function(resolve, reject) {
    db.list(RECIPES_COLLECTION_NAME, filter, function (err, data) {
      if (err) {
        reject({result:'ERROR', msg: err});
      } else {
        resolve(data);
      }
    });
  });
}

function _searchRecipes(filter) {
  return new Promise(function(resolve, reject) {
    var path = '/recipes';
    console.log('path: ' + path);

    $fh.service({
      "guid" : RECIPES_SERVICE_GUID, // The 24 character unique id of the service
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

function searchRecipes(filter) {
  console.log('RECIPES_SERVICE_MOCKED_UP', RECIPES_SERVICE_MOCKED_UP);
  if (RECIPES_SERVICE_MOCKED_UP === 'true') {
    console.log('_searchRecipesMockedUp');
    return _searchRecipesMockedUp(filter);
  } else {
    console.log('_searchRecipes');
    return _searchRecipes(filter);
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
    db.read(RECIPES_COLLECTION_NAME, id, function (err, data) {
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

    searchRecipes(filter).
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
