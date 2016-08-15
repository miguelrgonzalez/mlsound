var Promise = require('bluebird');
var common = require('../../lib/common.js');
var fs = require('fs');
var keys = Object.keys || require('object-keys');
var marklogic = require('marklogic');
var mlutil = require('marklogic/lib/mlutil.js');
var recursive = require('recursive-readdir');
var util = require('../../lib/utils.js');
var logger = util.consoleLogger;

var DBManager = module.exports;

DBManager.databaseOperation = function(operation, database) {
    var manager = this.getHttpManager();
    return new Promise(function(resolve, reject){
        //Issue command
        manager.post({
            endpoint: '/manage/LATEST/databases/' + database,
            body: { 'operation' : operation }
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 200) {
                    resolve(database);
                } else {
                    logger.error(response.data);
                    reject('Error when issuing database operation '+operation+' at '+database+' [Error '+response.statusCode+']');
                }
            });
        });
    });
};

DBManager.getDatabaseProperties = function(database) {
    var manager = this.getHttpManager();
    return new Promise(function(resolve, reject){
        //Issue command
        manager.get({
            endpoint: '/manage/LATEST/databases/' + database + '/properties?format=json'
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 200) {
                    resolve(response.data);
                } else {
                    logger.error(response.data);
                    reject('Error when fetching database properties at '+database+' [Error '+response.statusCode+']');
                }
            });
        });
    });
};

DBManager.buildDatabase = function(settings, type) {
    var BASE_SERVER_URL = '/manage/LATEST/databases';
    var UPDATE_SERVER_URL = BASE_SERVER_URL + '/' + settings['database-name'];
    var manager = this.getHttpManager();
    return new Promise(function(resolve, reject){
        //Check if server exists
        manager.get({
            endpoint: UPDATE_SERVER_URL
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 404) {
                    //database not found
                    //let's create it
                    logger.info('Creating ' + type +  ' database');
                    manager.post(
                        {
                            endpoint : BASE_SERVER_URL,
                            body : settings
                        }).then(function(resp) {
                            resp.result(function(response) {
                                if (response.statusCode === 201) {
                                    resolve(type + " database created");
                                } else {
                                    logger.error(response.data.errorResponse.message);
                                    reject('Error when creating '+type+' database [Error '+response.statusCode+']');
                                }
                            });
                        });
                } else if (response.statusCode === 200) {
                    manager.put(
                        {
                            endpoint : UPDATE_SERVER_URL + '/properties',
                            body : settings
                        }).then(function(resp) {
                            resp.result(function(response) {
                                if (response.statusCode !== 204) {
                                    logger.error(response.data);
                                    reject('Error when updating '+type+' database [Error '+response.statusCode+']');
                                } else {
                                    resolve(type + " database updated");
                                }
                            });
                        });
                } else {
                    logger.error(response.data);
                    reject('Error when checking '+type+' database [Error '+response.statusCode+']');
                }

            });
        });
    });
};

DBManager.initializeDatabase = function(type) {
    var that = this;
    return new Promise(function(resolve, reject){
        var settings = common.objectSettings('databases/' + type, this.env);
        if (!Array.isArray(settings.forest)) {
            // settings.forest may be an object that contains a forests-per-host value.
            that.buildForestsByHost(settings).then(function(forestNames) {
                settings.forest = forestNames;
                that.buildDatabase(settings, type).then(function(msg){
                    resolve(msg);
                });
            });
        } else {
            that.buildDatabase(settings, type).then(function(msg){
                resolve(msg);
            });
        }
    });

};

DBManager.removeDatabase = function(type, removeForest) {
    var that = this;
    return new Promise(function(resolve, reject){
        //check removeForest value
        if (removeForest && !/(configuration|data)/i.test(removeForest)) {
            reject('Only configuration and data allowed for removeForest parameter');
        }
        var settings = common.objectSettings('databases/' + type, that.env);
        var SERVER_URL = '/manage/LATEST/databases/' + settings['database-name'];
        var manager = that.getHttpManager();
    //Check if server exists
        manager.get({
            endpoint: SERVER_URL
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 200) {
                    manager.remove(
                        {
                            endpoint : SERVER_URL,
                            params : (removeForest ? { 'forest-delete' : removeForest } : undefined)
                        }).then(function(resp) {
                            resp.result(function(response) {
                                if (response.statusCode !== 204) {
                                    reject('Error when deleting '+type+' database [Error '+response.statusCode+']');
                                    logger.error(response.data);
                                }
                                resolve(type + 'database removed');
                            });
                        });
                } else if (response.statusCode === 404) {
                    //database already removed
                    resolve('Database already removed');
                } else {
                    reject('Error when deleting '+type+' database [Error '+response.statusCode+']');
                    logger.error(response.data);
                }
            });
        });
    });
};

DBManager.loadDocuments = function(root, folder, database) {
    var that = this;
    return new Promise(function(resolve, reject){
        var settings = mlutil.copyProperties(that.settings.connection);
        //Need to connect to Rest API, not management one
        settings.port = that.httpSettings.port;
        settings.database = database;
        var db = marklogic.createDatabaseClient(settings);
        recursive(folder, function (err, files) {

            var callBackwhenDone = (function() {
                var total = files.length;
                return function() {
                    total = total-1;
                    if (total < 1) {
                        resolve('Successfully Loaded...');
                    }
                };
            })();

            if (err) {
                reject(folder + ' Folder not found');
            }
            if (files.length === 0) {
                resolve('Nothing to do');
            }
            files.forEach(function(file){
                var document = fs.readFileSync(file, 'utf8');
                db.documents.write(
                  {
                    uri: file.replace(new RegExp('^'+root),''),
                    content: document
                  }
                ).result(
                    function(response) {
                        callBackwhenDone();
                    },
                    function(error) {
                        reject('Error loading file ' + file);
                        logger.error(error);
                    }
                );
            });
        });
    });
};

DBManager.deployTriggers = function(database) {
    var that = this;
    var manager = this.getHttpManager();
    var defs = this.getConfiguration("triggers", false);

    logger.info("Deploying triggers");
    return new Promise(function(resolve, reject){
            var callBackwhenDone = (function() {
                var total = defs.length;
                return function() {
                    total = total-1;
                    if (total < 1 ){
                        resolve('Triggers Initialized');
                    }
                };
            })();

            if (defs.length === 0) {
                resolve('Nothing to do');
            }

            //Initilialize all
            defs.forEach(function(item){
                var settings = common.objectSettings('triggers/' + item, that.env);
                var endpoint = '/manage/LATEST/databases/' + database + '/triggers';

                manager.get({
                        endpoint :  endpoint + '/' + settings['name'] + '/properties'
                }).then(function(resp) {
                    return new Promise(function(resolve, reject){
                        resp.result(
                            function(response) {
                                if (response.statusCode === 200) {
                                    //Delete trigger
                                    logger.info('Trigger ' + item + ' was already created. Deleting');
                                    manager.remove({
                                        endpoint :  endpoint + '/' + settings['name']
                                    }).then(function(resp) {
                                        resolve();
                                    });
                                } else if (response.statusCode === 404) {
                                    //There was no trigger with this name
                                    resolve();
                                } else {
                                    reject('Error while deleting trigger ' + item);
                                }
                            },
                            function(error) {
                                reject('Error Cheking for ' + item);
                                logger.error(error);
                            }
                        );
                    });
                })
                //Needs to wait a bit until delete is really processed
                //Not sure why, as promises are making sure commands are executed in the
                //right order
                .delay(1000)
                .then(function(resp) {
                    logger.info("Creating trigger " + item);
                    manager.post({
                            endpoint :  endpoint,
                            headers : { "Content-Type" : util.getContentType("json") },
                            body : settings
                    }).then(function(resp) {
                            resp.result(
                                function(response) {
                                    if (response.statusCode === 201 || response.statusCode === 200) {
                                        callBackwhenDone();
                                    } else {
                                        logger.error(JSON.stringify(response.data));
                                        reject('Error when deploying trigger at '+database+' [Error '+response.statusCode+']');
                                    }
                                },
                                function(error) {
                                    reject('Error loading file ' + item);
                                    logger.error(error);
                                });
                    });
                });
            });
    });
};
