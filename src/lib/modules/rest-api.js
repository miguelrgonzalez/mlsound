var Promise = require('bluebird');
var util = require('../utils.js');
var logger = util.consoleLogger;
var recursive = require('recursive-readdir');
var fs = require('fs');

var DBManager = module.exports;

DBManager.initializeRestAPI = function() {
    var that = this;
    var manager = this.getHttpManager();
    return new Promise(function(resolve, reject){
        //Check is REST API already exists
        manager.get({
            endpoint: '/LATEST/rest-apis/' + that.httpSettings['server-name']
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 404) {
                    //Rest API not found
                    //create REST API instance
                    manager.post(
                            {
                                endpoint : '/LATEST/rest-apis',
                                body : {
                                    'rest-api' : {
                                                    'name' : that.httpSettings['server-name'],
                                                    'port' : that.httpSettings.port,
                                                    'database' : that.httpSettings['content-database'],
                                                    'modules-database' : that.httpSettings['modules-database']
                                                 }
                                }
                     }).then(function(resp) {
                        resp.result(function(response) {
                            if (response.statusCode === 201) {
                                resolve('Rest API Created');
                            } else {
                                logger.error(JSON.stringify(response.data));
                                reject('Error when creating Rest API instance [Error '+response.statusCode+']');
                            }
                        });
                    });
                } else if (response.statusCode === 200) {
                    //Rest API already exists
                    resolve('Rest API already exists');
                } else {
                    logger.error(JSON.stringify(response.data));
                    reject('Something is not right  ['+response.statusCode+'] - ' + response.database);
                }

            });
        });
    });
};



DBManager.deployRestObjects = function(folder, type, message, omitName) {
    var manager = this.getRestAPIManager();
    var regEx = /(\/?.*\/)+(.+)\..+$/;
    logger.info("Deploying " + message);
    return new Promise(function(resolve, reject) {
        recursive(folder, function (err, files) {
            files = files || [];
            if (err) {
                reject(folder + ' Folder not found');
            }

            if (files.length === 0) {
                resolve('Nothing to do');
            }

            var callBackwhenDone = (function() {
                var total = files.length;
                return function() {
                    total = total-1;
                    if (total < 1) {
                        resolve(message + ' successfully installed ...');
                    }
                };
            })();


            files.forEach(function(file) {
                var document = fs.readFileSync(file, 'utf8');
                var path = file.match(regEx);

                var endpoint = '/LATEST/config/' + type ;
                if(omitName === undefined || !omitName) {
                    endpoint += '/' + path[path.length -1];
                }

                manager.put({
                    endpoint :  endpoint,
                    headers : { "Content-Type" : util.getContentType(file) },
                    body : document
                }).then(function(req) {
                    req.result(
                        function(response) {
                            if (response.statusCode === 201 || response.statusCode === 204) {
                                callBackwhenDone();
                            } else {
                                logger.error(response.data.errorResponse.message);
                                reject('Error loading ' + file);
                            }
                        },
                        function(error) {
                            logger.error(error);
                            reject('Error loading ' + file);
                        });
                });
            });
        });
    });
};

DBManager.deployRestExtensions = function(folder) {
    return this.deployRestObjects(folder, "resources", "Extensions");
};

DBManager.deployTransformations = function(folder) {
    return this.deployRestObjects(folder, "transforms", "Transformations");
};

DBManager.deployProperties = function(folder) {
    return this.deployRestObjects(folder, "properties", "Properties", true);
};

DBManager.deployOptions = function(folder) {
    return this.deployRestObjects(folder, "query", "Query options");
};

