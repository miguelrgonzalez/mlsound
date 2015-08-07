var common = require('../../lib/common.js');
var fs = require('fs');
var keys = Object.keys || require('object-keys');
var marklogic = require('marklogic');
var mlutil = require('marklogic/lib/mlutil.js');
var recursive = require('recursive-readdir');
var util = require('../../lib/utils.js');
var logger = util.consoleLogger;

var DBManager = module.exports;

DBManager.databaseOperation = function(operation, database, callback) {
    var manager = this.getHttpManager();
    //Issue command
    manager.post({
        endpoint: '/manage/v2/databases/' + database,
        body: { 'operation' : operation }
    }).
    result(function(response) {
        if (response.statusCode === 200) {
            if(callback) {
                callback();
            }
        }
        else {
            logger.error('Error when issuing database operation %s at %s [Error %s]',
                operation, database, response.statusCode);
            logger.error(response.data);
            process.exit(1);
        }
    });
};

DBManager.buildForestsByHost = function(dbSettings) {
    var count = dbSettings.forest['forests-per-host'];
    // idenfity the hosts
    var hosts = this.getConfiguration('hosts');
    // build forest names
    var forests = [], forestNames = [];
    hosts.forEach(function(host, index) {
        var hostSettings = common.objectSettings('hosts/' + host, this.env);
        console.log('host is: ' + hostSettings['host-name']);
        for (var i = 0; i < count; i++) {
            forests.push({'host': hostSettings['host-name'], 'forest-name': dbSettings['database-name'] + '-' + (index * count + i)});
        }
    });

    var manager = this.getHttpManager();
    forests.forEach(function(forest) {
        console.log('forest: ' + forest['forest-name']);
        forestNames.push(forest['forest-name']);
        manager.get({
            endpoint: '/manage/v2/forests/' + forest['forest-name']
        }).result(function(response) {
            if (response.statusCode === 404) {
                console.log('creating forest ' + forest['forest-name']);
                manager.post({
                    endpoint : '/manage/v2/forests',
                    body : forest
                }).result(function(response) {
                    if (response.statusCode === 201) {
                        // yay. do nothing. 
                    } else {
                        logger.error('Error when creating %s [Error %s]', forest, response.statusCode);
                        console.error(response.data);
                        process.exit(1);
                    }
               });
            } else if (response.statusCode === 200) {
            } else {
                logger.error('Error when checking %s [Error %s]', forest, response.statusCode);
                console.error(response.data);
                process.exit(1);
            }
        });
    });
    return forestNames;
};

DBManager.initializeDatabase = function(type, callback) {
    var settings = common.objectSettings('databases/' + type, this.env);
    var BASE_SERVER_URL = '/manage/v2/databases';
    var UPDATE_SERVER_URL = BASE_SERVER_URL + '/' + settings['database-name'];
    var manager = this.getHttpManager();

    if (!Array.isArray(settings.forest)) {
        console.log('forest setting: ' + JSON.stringify(settings.forest));
        // settings.forest may be an object that contains a forests-per-host value.
        settings.forest = this.buildForestsByHost(settings);
    }

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
                            logger.error('Error when creating %s database [Error %s]', type, response.statusCode);
                            logger.error(response.data);
                            process.exit(1);
                        }

                        if (callback) {
                            callback();
                        }
                });
        } else if (response.statusCode === 200) {
            manager.put(
                {
                    endpoint : UPDATE_SERVER_URL + '/properties',
                    body : settings
                }).result(function(response) {
                        if (response.statusCode !== 204) {
                            logger.error('Error when updating %s database [Error %s]', type, response.statusCode);
                            logger.error(response.data);
                            process.exit(1);
                        }

                        if (callback) {
                            callback();
                        }
                });
        } else {
            logger.error('Error when checking %s database [Error %s]', type, response.statusCode);
            logger.error(response.data);
            process.exit(1);
        }

    });
};

DBManager.removeDatabase = function(type, removeForest, callback) {
    //check removeForest value
    if (removeForest && !/(configuration|data)/i.test(removeForest)) {
        logger.error('Only configuration and data allowed for removeForest parameter');
        process.exit(1);
    }
    var settings = common.objectSettings('databases/' + type, this.env);
    var SERVER_URL = '/manage/v2/databases/' + settings['database-name'];
    var manager = this.getHttpManager();
    //Check if server exists
    manager.get({
        endpoint: SERVER_URL
    }).
    result(function(response) {
        if (response.statusCode === 200) {
            manager.remove(
                {
                    endpoint : SERVER_URL,
                    params : (removeForest ? { 'forest-delete' : removeForest } : undefined)
                }).result(function(response) {
                        if (response.statusCode !== 204) {
                            logger.error('Error when deleting %s database [Error %s]', type, response.statusCode);
                            logger.error(response.data);
                            process.exit(1);
                        }

                        if (callback) {
                            callback();
                        }
                });
        } else if (response.statusCode === 404) {
            //database already removed
            if (callback) {
                callback();
            }
        } else {
            logger.error('Error when deleting %s database [Error %s]', type, response.statusCode);
            logger.error(response.data);
            process.exit(1);
        }

    });
};

DBManager.loadDocuments = function(folder, database, callback) {

    var settings = mlutil.copyProperties(this.settings.connection);
    //Need to connect to Rest API, not management one
    settings.port = this.httpSettings.port;
    settings.database = database;
    var db = marklogic.createDatabaseClient(settings);

    recursive(folder, function (err, files) {
        var callBackwhenDone = (function() { var total = files.length;
            return function() {
                total = total-1;
                if (total < 1) {
                    callback();
                }
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
                    logger.error(error);
                    process.exit(1);
                }
            );
        });
    });
};
