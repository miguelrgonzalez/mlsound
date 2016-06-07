var Promise = require('bluebird');
var util = require('../../lib/utils.js');
var logger = util.loggerLogger;

var DBManager = module.exports;

DBManager.initializeRestAPI = function() {
    var that = this;
    var manager = this.getHttpManager();
    return new Promise(function(resolve, reject){
        //Check is REST API already exists
        manager.get({
            endpoint: '/LATEST/rest-apis/' + that.httpSettings['server-name']
        }).
        result(function(response) {
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
                        }).result(function(response) {
                            if (response.statusCode === 201) {
                                resolve('Rest API Created');
                            } else {
                                logger.error(response.data);
                                reject('Error when creating Rest API instance [Error '+response.statusCode+']');
                            }
                        });
            } else if (response.statusCode === 200) {
                //Rest API already exists
                resolve('Rest API already exists');
            } else {
                logger.error(response.data);
                reject('Something is not right  ['+response.statusCode+'] - ' + response.database);
            }

        });
    });
};
