var colors = require('colors');
var common = require('../lib/common.js');
var fs = require('fs');
var keys = Object.keys || require('object-keys');
var marklogic = require('marklogic');
var mlutil = require('marklogic/lib/mlutil.js');
var recursive = require('recursive-readdir');
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

    for(key in allowed){
        newObj[key] = object[key];
    }

    return newObj;
};

DBManager.prototype.restartGroup = function(callback) {
    var that = this;
    var manager = this.getHttpManager();
    //Issue command
    manager.post({
        endpoint: '/manage/v2/groups/' + this.httpSettings["group-name"],
        body: { "operation" : "restart-group"}
    }).
    result(function(response) {
        if (response.statusCode === 202) {
            if(callback) callback();
        }
        else {
            logger.error('Error when restarting server group ' + that.httpSettings["group-name"]
                          + ' [Error %s]', response.statusCode);
            console.error(response.data);
            process.exit(1);
        }
    });
};

DBManager.prototype.databaseOperation = function(operation, database, callback) {
    var manager = this.getHttpManager();
    //Issue command
    console.log('/manage/v2/databases/' + database);
    manager.post({
        endpoint: '/manage/v2/databases/' + database,
        body: { "operation" : operation }
    }).
    result(function(response) {
        if (response.statusCode === 202) {
            if(callback) callback();
        }
        else {
            logger.error('Error when issuing database operation %s at %s [Error %s]',
                operation, database, response.statusCode);
            console.error(response.data);
            process.exit(1);
        }
    });
};

DBManager.prototype.initializeRestAPI = function(callback) {
    var that = this;
    var manager = this.getHttpManager();
    //Check is REST API already exists
    manager.get({
        endpoint: '/LATEST/rest-apis/' + this.httpSettings["server-name"]
    }).
    result(function(response) {
        if (response.statusCode === 404) {
            //Rest API not found
            //create REST API instance
            manager.post(
                    {
                        endpoint : '/LATEST/rest-apis',
                        body : {
                            "rest-api" : {
                                            "name" : that.httpSettings["server-name"],
                                            "port" : that.httpSettings.port,
                                            "database" : that.httpSettings["content-database"],
                                            "modules-database" : that.httpSettings["modules-database"]
                                         }
                        }
                    }).result(function(response) {
                        if (response.statusCode === 201) {
                            if (callback) callback();
                        } else {
                            logger.error('Error when creating Rest API instance [Error %s]', response.statusCode);
                            console.error(response.data);
                            process.exit(1);
                        }
                    });
        } else if (response.statusCode === 200) {
            //Rest API already exists
            if (callback) callback();
        } else {
            logger.error('Something is not right [%s] - %s', response.statusCode, response.data);
            console.error(response.data);
            process.exit(1);
        }

    });
};

DBManager.prototype.updateServer = function(type, callback) {
    var UPDATE_SERVER_URL = '/manage/v2/servers/' + this.httpSettings["server-name"];
    var manager = this.getHttpManager();
    var settings = common.objectSettings('servers/' + type, this.env);
    //Check if server exists
    manager.get({
        endpoint: UPDATE_SERVER_URL,
        params : { "group-id" : settings["group-name"] }
    }).
    result(function(response) {
        if (response.statusCode === 200) {
            manager.put(
                {
                    endpoint : UPDATE_SERVER_URL + '/properties',
                    body : settings,
                    params : { "group-id" : settings["group-name"] }
                }).result(function(response) {
                        if (response.statusCode === 202) {
                            logger.info('Rest API instance updated');
                        } else if (response.statusCode === 204) {
                            logger.info('Server restart needed!');
                        } else {
                            console.error("Error when updating Rest API instance [Error %s]", response.statusCode);
                            console.error(response.data);
                            process.exit(1);
                        }

                        if (callback)
                            callback();
                });
        }
    });
};

DBManager.prototype.initializeDatabase = function(type, callback) {
    var settings = common.objectSettings('databases/' + type, this.env);
    var BASE_SERVER_URL = '/manage/v2/databases';
    var UPDATE_SERVER_URL = BASE_SERVER_URL + '/' + settings["database-name"];
    var manager = this.getHttpManager();
    //Check if server exists
    manager.get({
        endpoint: UPDATE_SERVER_URL
    }).
    result(function(response) {
        if (response.statusCode === 404) {
            //database not found
            //let's create it
            logger.info('Creating ' + type +  ' database');
            manager.post(
                {
                    endpoint : BASE_SERVER_URL,
                    body : settings
                }).result(function(response) {
                        if (response.statusCode === 201) {
                            logger.info(type + ' database created');
                        } else {
                            logger.error('Error when creating ' + type + ' database [Error %s]', response.statusCode);
                            console.error(response.data);
                            process.exit(1);
                        }

                        if (callback)
                            callback();
                });
        } else if (response.statusCode === 200) {
            manager.put(
                {
                    endpoint : UPDATE_SERVER_URL + '/properties',
                    body : settings
                }).result(function(response) {
                        if (response.statusCode !== 204) {
                            logger.error('Error when updating ' + type + ' database [Error %s]', response.statusCode);
                            console.error(response.data);
                            process.exit(1);
                        }

                        if (callback)
                            callback();
                });
        } else {
            logger.error('Error when checking for ' + type + ' database [Error %s]', response.statusCode);
            console.error(response.data);
            process.exit(1);
        }

    });
};

DBManager.prototype.getConfigurationFiles = function(folder, fail_on_error) {
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
            if (fail_on_error) {
                console.error(folder + ' Not found!!!! ');
                process.exit(1);
            } else {
                //return empty forest list
                return [];
            }
        }
};

DBManager.prototype.initializeMultiObjects = function(type, url, typeName, supported, callback) {

    var baseDefs = this.getConfigurationFiles('./settings/base-configuration/' + type + '/', true)
    var envDefs = this.getConfigurationFiles('./settings/' + this.env + '/' + type + '/', false)

    //merge lists and remove duplicates
    var defs = baseDefs.concat(envDefs);
    defs = defs.filter(function(elem, pos) {
        return defs.indexOf(elem) == pos;
    });

    var that = this;

    var callBackwhenDone = (function() {
        var total = defs.length;
        return function() {
            total = total-1;
            if (total < 1) callback();
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
                        logger.error('Error when creating ' + item + ' [Error %s]', response.statusCode);
                        console.error(response.data);
                        process.exit(1);
                    };
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
                            logger.error('Error when updating ' + item + ' [Error %s]', response.statusCode);
                            console.error(response.data);
                            process.exit(1);
                        };
                   });
               } else {
                   //nothing to send. We are done with this
                   callBackwhenDone();
               }
            } else {
                logger.error('Error when checking for ' + item + ' [Error %s]', response.statusCode);
                console.error(response.data);
                process.exit(1);
            };
        });
    });
};

DBManager.prototype.initializeForests = function(callback) {
    //See : http://docs.marklogic.com/REST/PUT/manage/v2/forests/[id-or-name]/properties
    var supported = ['enabled', 'updates-allowed', 'availability',
                    'rebalancer-enable', 'range', 'failover-enable',
                    'failover-host', 'failover-replica'];
    this.initializeMultiObjects('forests', 'forests', 'forest-name', supported, callback);
};

DBManager.prototype.initializeUsers = function(callback) {
    this.initializeMultiObjects('security/users', 'users', 'user-name', undefined, callback);
};

DBManager.prototype.initializeRoles = function(callback) {
    this.initializeMultiObjects('security/roles', 'roles', 'role-name', undefined, callback);
};

DBManager.prototype.initializeGroups = function(callback) {
    this.initializeMultiObjects('groups', 'groups', 'group-name', undefined, callback);
};


DBManager.prototype.loadDocuments = function(folder, database, callback) {

    var settings = mlutil.copyProperties(this.settings.connection);
    //Need to connect to Rest API, not management one
    settings.port = this.httpSettings.port;
    settings.database = database
    var db = marklogic.createDatabaseClient(settings);

    recursive(folder, function (err, files) {
        var callBackwhenDone = (function() { var total = files.length;
            return function() {
                total = total-1;
                if (total < 1) callback();
            };
        })();

        if (err) {
            logger.error(folder + ' Folder not found');
            process.exit(1);
        }
        files.forEach(function(file){
            var document = fs.readFileSync(file, 'utf8');
            db.documents.write(
              {
                uri: file.replace(new RegExp('^'+folder),''),
                content: document
              }
            ).result(
                function(response) {
                    callBackwhenDone();
                },
                function(error) {
                    logger.error('Error loading file ' + file);
                    console.error(error);
                    process.exit(1);
                }
            );
        });
    });
};

var createDBManager = function(env) {
    return new DBManager(env);
};

module.exports = {
    createDBManager : createDBManager
};
