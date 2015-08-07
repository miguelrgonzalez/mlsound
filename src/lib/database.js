var common = require('../lib/common.js');
var conflate = require('conflate');
var fs = require('fs');
var keys = Object.keys || require('object-keys');
var marklogic = require('marklogic');
var util = require('../lib/utils.js');
var logger = util.consoleLogger;

var DBManager = function(env) {
    if(!(this instanceof DBManager)) {
        return new DBManager(env);
    }
    this.env = env;
    this.settings = common.objectSettings('connection', env);
    this.httpSettings = common.objectSettings('servers/http', env);
};

DBManager.prototype.getDatabaseClient = function () {
    if(!this.dbClient){
        this.dbClient = marklogic.createDatabaseClient(this.settings.connection);
    }
    return this.dbClient;
};

DBManager.prototype.getHttpManager = function (client) {
    if(client) {
        return common.createHttpManager(client);
    } else {
        if(!this.httpManager){
            this.httpManager = common.createHttpManager(this.getDatabaseClient());
        }
        return this.httpManager;
    }
};

DBManager.prototype.filterUnsupportedProperties = function(supported, object) {
    var allowed = keys(object).filter(function(el) {
        return supported.indexOf(el) > 0;
    });

    var newObj = {};

    for(var key in allowed){
        newObj[key] = object[key];
    }

    return newObj;
};

DBManager.prototype.getConfigurationFiles = function(folder, failOnError) {
        var removeExt = function(ext) {
            var re = new RegExp(ext + '$', 'g');
            return function(string) {
                return string.replace(re, '');
            };
        };
        try {
            //return configuration files without the extension
            return fs.readdirSync(folder).map(removeExt('.json'));
        } catch(e) {
            if (failOnError) {
                console.error(folder + ' Not found!!!! ');
                process.exit(1);
            } else {
                //return empty forest list
                return [];
            }
        }
};

DBManager.prototype.initializeMultiObjects = function(type, url, typeName, supported, callback) {

    var baseDefs = this.getConfigurationFiles('./settings/base-configuration/' + type + '/', true);
    var envDefs = this.getConfigurationFiles('./settings/' + this.env + '/' + type + '/', false);

    //merge lists and remove duplicates
    var defs = baseDefs.concat(envDefs);
    defs = defs.filter(function(elem, pos) {
        return defs.indexOf(elem) === pos;
    });

    var that = this;

    var callBackwhenDone = (function() {
        var total = defs.length;
        return function() {
            total = total-1;
            if (total < 1) {
                callback();
            }
        };
    })();

    //Initilialize all
    defs.forEach(function(item){
        var settings = common.objectSettings(type + '/' + item, that.env);
        var BASE_SERVER_URL = '/manage/v2/' + url;
        var UPDATE_SERVER_URL = BASE_SERVER_URL + '/' + settings[typeName];
        var manager = that.getHttpManager();

        //Check if exists
        manager.get({
            endpoint: UPDATE_SERVER_URL
        }).
        result(function(response) {
            if (response.statusCode === 404) {
                /* does not exist. Create it */
               manager.post({
                   endpoint : BASE_SERVER_URL,
                   body : settings
               })
               .result(function(response) {
                    if (response.statusCode === 201) {
                        callBackwhenDone();
                    } else {
                        logger.error('Error when creating %s [Error %s]', item, response.statusCode);
                        console.error(response.data);
                        process.exit(1);
                    }
               });
            } else if (response.statusCode === 200) {
               //Already present.
               //Sometimes only some of the properties are allowed on update. Remove non supported ones
               //Construct payload based on supported properties
               var payload = supported ? that.filterUnsupportedProperties(supported, settings) : settings;
               if(keys(payload).length > 0){
                   //There is something to send
                   manager.put({
                       endpoint : UPDATE_SERVER_URL + '/properties',
                       body : settings
                   })
                   .result(function(response) {
                        if (response.statusCode === 204) {
                            callBackwhenDone();
                        } else {
                            logger.error('Error when updating %s [Error %s]', item, response.statusCode);
                            console.error(response.data);
                            process.exit(1);
                        }
                   });
               } else {
                   //nothing to send. We are done with this
                   callBackwhenDone();
               }
            } else {
                logger.error('Error when checking %s [Error %s]', item, response.statusCode);
                console.error(response.data);
                process.exit(1);
            }
        });
    });
};

DBManager.prototype.removeMultiObjects = function(type, url, typeName, params, callback) {

    var baseDefs = this.getConfigurationFiles('./settings/base-configuration/' + type + '/', true);
    var envDefs = this.getConfigurationFiles('./settings/' + this.env + '/' + type + '/', false);

    //merge lists and remove duplicates
    var defs = baseDefs.concat(envDefs);
    defs = defs.filter(function(elem, pos) {
        return defs.indexOf(elem) === pos;
    });

    var that = this;

    var callBackwhenDone = (function() {
        var total = defs.length;
        return function() {
            total = total-1;
            if (total < 1) {
                callback();
            }
        };
    })();

    //Initilialize all
    defs.forEach(function(item){
        var settings = common.objectSettings(type + '/' + item, that.env);
        var SERVER_URL = '/manage/v2/' + url +  '/' + settings[typeName];
        var manager = that.getHttpManager();
        //Check if exists
        manager.get({
            endpoint: SERVER_URL
        }).
        result(function(response) {
            if (response.statusCode === 200) {
               //present.
               manager.remove({
                   endpoint : SERVER_URL,
                   params : params
               })
               .result(function(response) {
                    if (response.statusCode === 204) {
                        callBackwhenDone();
                    } else {
                        logger.error('Error when deleting %s [Error %s]', item, response.statusCode);
                        console.error(response.data);
                        process.exit(1);
                    }
               });
            } else if (response.statusCode === 404) {
                //already removed
                callBackwhenDone();
            } else {
                logger.error('Error when checking %s [Error %s]', item, response.statusCode);
                console.error(response.data);
                process.exit(1);
            }
        });
    });
};

var createDBManager = function(env) {
    return new DBManager(env);
};

// Load modules from the modules folder to extend the prototype
// DBManager was getting too big
var files = fs.readdirSync(__dirname + '/modules/');
for(var i = 0; i < files.length; i++){
  if(files[i].match(/.*\.js/)){
    var mod = require('./modules/' + files[i]);
    conflate(DBManager.prototype, mod);
  }
}

module.exports = {
    createDBManager : createDBManager
};
