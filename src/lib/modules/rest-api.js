var util = require('../../lib/utils.js');
var logger = util.loggerLogger;

var DBManager = module.exports;

DBManager.initializeRestAPI = function(callback) {
    var that = this;
    var manager = this.getHttpManager();
    //Check is REST API already exists
    manager.get({
        endpoint: '/LATEST/rest-apis/' + this.httpSettings['server-name']
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
                            if (callback) {
                                callback();
                            }
                        } else {
                            logger.error('Error when creating Rest API instance [Error %s]', response.statusCode);
                            logger.error(response.data);
                            process.exit(1);
                        }
                    });
        } else if (response.statusCode === 200) {
            //Rest API already exists
            if (callback) {
                callback();
            }
        } else {
            logger.error('Something is not right [%s] - %s', response.statusCode, response.data);
            logger.error(response.data);
            process.exit(1);
        }

    });
};
