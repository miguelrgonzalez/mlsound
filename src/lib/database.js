var Promise = require('bluebird');
var common = require('../lib/common.js');
var conflate = require('conflate');
var fs = require('fs');
var keys = Object.keys || require('object-keys');
var marklogic = require('marklogic');
var mlutil = require('marklogic/lib/mlutil.js');
var util = require('../lib/utils.js');
var logger = util.consoleLogger;

var DBManager = function(env){

    if(!(this instanceof DBManager)) {
        return new DBManager(env);
    }
    this.env = env;
    this.settings = common.objectSettings('connection', env);
    this.httpSettings = common.objectSettings('servers/http', env);
    this.configuration = {};
};

DBManager.prototype.getRestAPIManager = function () {
    var settings = mlutil.copyProperties(this.settings.connection);
    settings.port = this.httpSettings.port;
    return this.getHttpManager(marklogic.createDatabaseClient(settings));
};

DBManager.prototype.getDatabaseClient = function () {
    if(!this.dbClient){
        this.dbClient = marklogic.createDatabaseClient(this.settings.connection);
    }
    return this.dbClient;
};

DBManager.prototype.getHttpManager = function (client) {
    if (client) {
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
        return supported.indexOf(el) >= 0;
    });

    var newObj = {};

    for(var i in allowed){
        newObj[allowed[i]] = object[allowed[i]];
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
                //return empty list
                return [];
            }
        }
};

DBManager.prototype.getConfiguration = function(type, failOnError) {
    if (!this.configuration[type]) {
        var baseDefs = this.getConfigurationFiles('./settings/base-configuration/' + type + '/',
                                                  failOnError === undefined ? true : failOnError);
        var envDefs = this.getConfigurationFiles('./settings/' + this.env + '/' + type + '/', false);

        //merge lists and remove duplicates
        var defs = baseDefs.concat(envDefs);
        defs = defs.filter(function(elem, pos) {
            return defs.indexOf(elem) === pos;
        });

        this.configuration[type] = defs;
    }

    return this.configuration[type];
};

/*
 * This method will try to configure any kind of REST endpoint which has the configuration
 * in the form of /<api-endpoint>/<multiple-configuration-files>
 *
 * Parameters:
 *  - type: Where to get the configuration files for this endpoint type. example ('alerts/config')
 *  - url:  Rest URL after /manage/LATEST. Example: 'alerts/config'
 *  - typeName: which property from the configuration file to use as the Key.
 *      Example: /alert/actions/{id|name}/properties
 *  - supported: sometimes there are properties in the JSON payload which are only suported at 
 *    creation time, but not on update.
 *  - database: the database name to be included in the URL. If undefinned it will ommit this part
 *      Example: /manage/v2/databases/{id|name}/alert/actions/{id|name}/properties
 *  - appendUrl: what to append at the end of the URL. Some REST endpoints do need something extra.
 *      Example: /properties?uri=my-alert-config
 *
 *
 */
DBManager.prototype.initializeMultiObjects = function(type, url, typeName,
                                                      supported, database, appendUrl) {

    var defs = this.getConfiguration(type);

    var that = this;
    return new Promise(function(resolve, reject){
        var callBackwhenDone = (function() {
            var total = defs.length;
            return function() {
                total = total-1;
                if (total < 1 ){
                    resolve(url + ' Initialized');
                }
            };
        })();

        if (defs.length === 0) {
            resolve('Nothing to do');
        }
        //Initilialize all
        defs.forEach(function(item){
            var settings = common.objectSettings(type + '/' + item, that.env);
            var BASE_SERVER_URL = '/manage/LATEST/';
            if(database !== undefined) {
                BASE_SERVER_URL += 'databases/' + database + '/';
            }
            BASE_SERVER_URL += url;
            if (appendUrl !== undefined && !(/\?.*=/.test(appendUrl))) {
                BASE_SERVER_URL += appendUrl;
            }

            var UPDATE_SERVER_URL = BASE_SERVER_URL;
            var manager = that.getHttpManager();
            var endpoint = ''
            //if the appendUrl contains a HTTP parameter there is no need for a /
            if(/\?.*=/.test(appendUrl)) {
                if(/.*=$/.test(appendUrl)) {
                   endpoint = UPDATE_SERVER_URL +  appendUrl + settings[typeName];
                } else {
                   //the caller is already setting up the parameter
                   endpoint = UPDATE_SERVER_URL + appendUrl;
                }
            } else {
               endpoint = UPDATE_SERVER_URL + '/' + settings[typeName];
            }
            //Check if exists
            manager.get({
                endpoint: endpoint
            }).then(function (resp) {
                resp.result(function(response) {
                    if (response.statusCode === 404) {
                        /* does not exist. Create it */
                       manager.post({
                           endpoint : BASE_SERVER_URL,
                           body : settings
                       }).then(function(resp) {
                           resp.result(function(response) {
                                if (response.statusCode === 201) {
                                    callBackwhenDone();
                                } else {
                                    reject('Error when creating '+item+' [Error '+ response.statusCode +']');
                                    console.error(response.data);
                                }
                           });
                       });
                    } else if (response.statusCode === 200) {
                       //Already present.
                       //Sometimes only some of the properties are allowed on update. Remove non supported ones
                       //Construct payload based on supported properties
                       var payload = supported ? that.filterUnsupportedProperties(supported, settings) : settings;
                       if(keys(payload).length > 0){
                           //There is something to send
                           var endpoint = ''
                           if(/\?.*=/.test(appendUrl)) {
                               if(/.*=$/.test(appendUrl)) {
                                   endpoint = UPDATE_SERVER_URL + '/properties' +  appendUrl + settings[typeName];
                               } else {
                                   //the caller is already setting up the parameter
                                   endpoint = UPDATE_SERVER_URL + '/properties' +  appendUrl;
                               }
                           } else {
                               endpoint = UPDATE_SERVER_URL + '/' + settings[typeName] + '/properties';
                           }
                           manager.put({
                               endpoint: endpoint,
                               body : payload
                           }).then(function(resp) {
                               resp.result(function(response) {
                                    if (response.statusCode === 204) {
                                        callBackwhenDone();
                                    } else {
                                        console.error(response.data);
                                        reject('Error when updating '+item+' [Error '+ response.statusCode +']');
                                    }
                               });
                           });
                       } else {
                           //nothing to send. We are done with this
                           callBackwhenDone();
                       }
                    } else {
                        console.error(response.data);
                        reject('Error when checking '+item+' [Error '+ response.statusCode +']');
                    }
                });
            });
        });

    });

};

DBManager.prototype.removeMultiObjects = function(type, url, typeName, params) {

    var defs = this.getConfiguration(type);
    var that = this;

    return new Promise(function(resolve, reject){
        var callBackwhenDone = (function() {
            var total = defs.length;
            return function() {
                total = total-1;
                if (total < 1) {
                    resolve(type + ' removed');
                }
            };
        })();
        //Initilialize all
        defs.forEach(function(item){
            var settings = common.objectSettings(type + '/' + item, that.env);
            var SERVER_URL = '/manage/LATEST/' + url +  '/' + settings[typeName];
            var manager = that.getHttpManager();
            //Check if exists
            manager.get({
                endpoint: SERVER_URL
            }).then(function(resp) {
                resp.result(function(response) {
                    if (response.statusCode === 200) {
                       //present.
                       manager.remove({
                           endpoint : SERVER_URL,
                           params : params
                       }).then(function(resp) {
                           resp.result(function(response) {
                                if (response.statusCode === 204) {
                                    callBackwhenDone();
                                } else {
                                    reject('Error when deleting '+item+' [Error '+response.statusCode+']');
                                    //logger.error('Error when deleting %s [Error %s]', item, response.statusCode);
                                    console.error(response.data);
                                    //process.exit(1);
                                }
                           });
                       });
                    } else if (response.statusCode === 404) {
                        //already removed
                        callBackwhenDone();
                    } else {
                        reject('Error when checking '+item+' [Error '+response.statusCode+']');
                        //logger.error('Error when checking %s [Error %s]', item, response.statusCode);
                        console.error(response.data);
                        //process.exit(1);
                    }
                });
            });
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
