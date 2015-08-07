var Operation = require('marklogic/lib/operation.js');
var fs = require('fs');
var mlutil = require('marklogic/lib/mlutil.js');
var path = require('path');
var requester = require('marklogic/lib/requester.js');
var valcheck = require('core-util-is');
JSON.minify = require('node-json-minify');

var mergeSettings = function(defaults, extra) {

    var parseFile = function(file, failOnError) {
        try{
            //minify takes care of comments, and other non-json stuff
            return JSON.parse(JSON.minify(fs.readFileSync(file, 'utf8')));
        } catch (err) {
            if (err.code === 'ENOENT' && failOnError) {
                console.error('%s not found', file);
                process.exit(1);
            } else if (err instanceof SyntaxError) {
                console.error('%s is not properly formatted %s', file, err);
                process.exit(1);
            }
        }
    };

    var merge = function(options1, options2) {
        for(var setting in options2) {
            if (typeof options2[setting] === 'object') {
                //recursively merge
                options1[setting] = merge(options1[setting], options2[setting]);
            } else {
                options1[setting] = options2[setting];
            }
        }
        return options1;
    };

    //read defaults
    var defaultsJSON = parseFile(defaults, true);

    //read extra
    var extraJSON = parseFile(extra, false);

    if (extraJSON) {
        //merge settings
        defaultsJSON = merge(defaultsJSON, extraJSON);
    }
    //return environment settings

    return defaultsJSON;
};

/* Merge default and environment settings for a given configuration object*/
var objectSettings = function(object, env) {
    //merge settings
    return mergeSettings('settings/base-configuration/' + object +'.json',
                         'settings/environments/' + env + '/' + object + '.json');

};

/*
 * Credit goes to marklogic-node-client api /etc/test-lib
 * */
var responseOutputTransform = function(headers, data) {
  /*jshint validthis:true */
  var operation = this;

  var response = {
      statusCode: operation.responseStatusCode,
      headers:    headers
  };
  if (!valcheck.isNullOrUndefined(data)) {
    response.data = data;
  }

  return response;
};

var Manager = function(adminClient) {
    //force function to be called via new
    if(!(this instanceof Manager)) {
        return new Manager(adminClient);
    }
    this.client = adminClient;
};

Manager.prototype.get = function(paramsObj) {
  var endpoint    = paramsObj.endpoint;
  var params      = paramsObj.params;
  var headers     = paramsObj.headers;
  var hasResponse = paramsObj.hasResponse;

  var path = makePath(endpoint, params);

  var requestOptions = mlutil.copyProperties(this.client.connectionParams);
  requestOptions.method = 'GET';
  requestOptions.headers = valcheck.isNullOrUndefined(headers) ? {
    'Accept': 'application/json'
    } : headers;
  requestOptions.path = path;

  var operation = new Operation(
      'GET '+path, this.client, requestOptions, 'empty',
      ((hasResponse === 'false') ? 'empty' : 'single')
      );
  operation.validStatusCodes = [200, 201, 204, 404, 400];
  operation.outputTransform  = responseOutputTransform;

  return requester.startRequest(operation);
};

Manager.prototype.post = function(paramsObj) {
  var endpoint    = paramsObj.endpoint;
  var params      = paramsObj.params;
  var headers     = paramsObj.headers;
  var body        = paramsObj.body;
  var hasResponse = paramsObj.hasResponse;

  var path = makePath(endpoint, params);

  var requestOptions = mlutil.copyProperties(this.client.connectionParams);
  requestOptions.method = 'POST';
  requestOptions.headers = valcheck.isNullOrUndefined(headers) ? {
    'Content-Type': 'application/json',
    'Accept':       'application/json'
    } : headers;
  requestOptions.path = path;

  var hasBody = !valcheck.isNullOrUndefined(body);

  var operation = new Operation(
      'POST '+path,
      this.client,
      requestOptions,
      hasBody ? 'single' : 'empty',
      ((hasResponse === 'false') ? 'empty' : 'single')
      );

  operation.validStatusCodes = [200, 201, 202, 204, 400];
  operation.outputTransform  = responseOutputTransform;
  if (hasBody) {
    operation.requestBody = body;
  }

  return requester.startRequest(operation);
};

Manager.prototype.put = function(paramsObj) {
  var endpoint    = paramsObj.endpoint;
  var params      = paramsObj.params;
  var headers     = paramsObj.headers;
  var body        = paramsObj.body;
  var hasResponse = paramsObj.hasResponse;

  var path = makePath(endpoint, params);

  var requestOptions = mlutil.copyProperties(this.client.connectionParams);
  requestOptions.method = 'PUT';
  requestOptions.headers = valcheck.isNullOrUndefined(headers) ? {
    'Content-Type': 'application/json'
    } : headers;
  requestOptions.path = path;

  var hasBody = !valcheck.isNullOrUndefined(body);

  var operation = new Operation(
      'PUT '+path,
      this.client,
      requestOptions,
      hasBody ? 'single' : 'empty',
      ((hasResponse === 'true') ? 'single' : 'empty')
      );

  operation.validStatusCodes = [201, 204, 400];
  operation.outputTransform  = responseOutputTransform;
  if (hasBody) {
    operation.requestBody = body;
  }

  return requester.startRequest(operation);
};

Manager.prototype.remove = function(paramsObj) {
  var endpoint    = paramsObj.endpoint;
  var params      = paramsObj.params;
  var headers     = paramsObj.headers;
  var hasResponse = paramsObj.hasResponse;

  var path = makePath(endpoint, params);

  var requestOptions = mlutil.copyProperties(this.client.connectionParams);
  requestOptions.method = 'DELETE';
  requestOptions.headers = valcheck.isNullOrUndefined(headers) ? {
    'Accept': 'application/json'
    } : headers;
  requestOptions.path = path;

  var operation = new Operation(
      'DELETE '+path,
      this.client,
      requestOptions,
      'empty',
      ((hasResponse === 'true') ? 'single' : 'empty')
      );
  operation.outputTransform  = responseOutputTransform;

  return requester.startRequest(operation);
};

var makePath = function(endpoint, params) {
  var path = encodeURI(endpoint);
  if (!valcheck.isNullOrUndefined(params)) {
    var paramKeys = Object.keys(params);
    var sep = '?';
    for (var i=0; i < paramKeys.length; i++) {
      var paramKey = paramKeys[i];
      var value = params[paramKey];
      if (valcheck.isArray(value)) {
        for (var j=0; j < value.length; j++) {
          path += sep+paramKey+'='+encodeURIComponent(value[j]);
          if (i === 0 && j === 0) {
            sep = '&';
          }
        }
      } else {
        path += sep+paramKey+'='+encodeURIComponent(value);
        if (i === 0) {
          sep = '&';
        }
      }
    }
  }

  return path;
};

var createManager = function(adminClient) {
    return new Manager(adminClient);
};

module.exports = {
    objectSettings  : objectSettings,
    createHttpManager : createManager
};
