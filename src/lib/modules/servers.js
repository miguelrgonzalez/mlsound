var common = require('../../lib/common.js');
var util = require('../../lib/utils.js');
var logger = util.consoleLogger;

var DBManager = module.exports;

DBManager.restartGroup = function(callback) {
    var that = this;
    var manager = this.getHttpManager();
    //Issue command
    manager.post({
        endpoint: '/manage/v2/groups/' + this.httpSettings['group-name'],
        body: { 'operation' : 'restart-group'}
    }).
    result(function(response) {
        if (response.statusCode === 202) {
            if(callback) {
                callback();
            }
        }
        else {
            logger.error('Error when restarting server group %s [Error %s]',
                that.httpSettings['group-name'], response.statusCode);
            logger.error(response.data);
            process.exit(1);
        }
    });
};

DBManager.initializeGroups = function(callback) {
    this.initializeMultiObjects('groups', 'groups', 'group-name', undefined, callback);
};

DBManager.initializeHosts = function(callback) {
    this.initializeMultiObjects('hosts', 'hosts', 'host-name', undefined, callback);
};

DBManager.updateServer = function(type, callback) {
    var UPDATE_SERVER_URL = '/manage/v2/servers/' + this.httpSettings['server-name'];
    var manager = this.getHttpManager();
    var settings = common.objectSettings('servers/' + type, this.env);
    //Check if server exists
    manager.get({
        endpoint: UPDATE_SERVER_URL,
        params : { 'group-id' : settings['group-name'] }
    }).
    result(function(response) {
        if (response.statusCode === 200) {
            manager.put(
                {
                    endpoint : UPDATE_SERVER_URL + '/properties',
                    body : settings,
                    params : { 'group-id' : settings['group-name'] }
                }).result(function(response) {
                        if (response.statusCode === 202) {
                            logger.info('Rest API instance updated');
                        } else if (response.statusCode === 204) {
                            logger.info('Server restart needed!');
                        } else {
                            logger.error('Error when updating Rest API instance [Error %s]', response.statusCode);
                            logger.error(response.data);
                            process.exit(1);
                        }

                        if (callback) {
                            callback();
                        }
                });
        }
    });
};

DBManager.removeServer = function(type, callback) {
    var SERVER_URL = '/manage/v2/servers/' + this.httpSettings['server-name'];
    var manager = this.getHttpManager();
    var that = this;
    var settings = common.objectSettings('servers/' + type, this.env);
    //Check if server exists
    manager.get({
        endpoint: SERVER_URL,
        params : { 'group-id' : settings['group-name'] }
    }).
    result(function(response) {
        if (response.statusCode === 200) {
            manager.remove(
                {
                    endpoint : SERVER_URL,
                    params : { 'group-id' : settings['group-name'] }
                }).result(function(response) {
                        if (response.statusCode === 202) {
                            logger.info('HTTP server removed');
                        } else if (response.statusCode === 204) {
                            logger.info('Server restart needed!');
                        } else {
                            logger.error('Error when trying to remove app server %s [Error %s]',
                                that.httpSettings['server-name'], response.statusCode);
                            logger.error(response.data);
                            process.exit(1);
                        }

                        if (callback) {
                            callback();
                        }
                });
        } else if (response.statusCode === 404) {
            //No need to remove anything. Just finished
            if (callback) {
                callback();
            }
        }
    });
};

DBManager.initializeForests = function(callback) {
    //See : http://docs.marklogic.com/REST/PUT/manage/v2/forests/[id-or-name]/properties
    var supported = ['enabled', 'updates-allowed', 'availability',
                    'rebalancer-enable', 'range', 'failover-enable',
                    'failover-host', 'failover-replica'];
    this.initializeMultiObjects('forests', 'forests', 'forest-name', supported, callback);
};

DBManager.buildForestsByHost = function(dbSettings, callback) {

    // from http://stackoverflow.com/questions/1267283/how-can-i-create-a-zerofilled-value-using-javascript
    function pad(number, padding, character) {
        var pad_char = typeof character !== 'undefined' ? character : '0';
        var buffer = new Array(1 + padding).join(pad_char);
        return (buffer + number).slice(-buffer.length);
    }

    // idenfity the hosts
    var hosts = this.getConfiguration('hosts');
    // build forest names
    var forests = [], forestNames = [];
    hosts.forEach(function(host, index) {
        var hostSettings = common.objectSettings('hosts/' + host, this.env);
        for (var i = 0; i < dbSettings.forest['forests-per-host']; i++) {
            forests.push({
                'host': hostSettings['host-name'],
                'forest-name': dbSettings['database-name'] + '-' + pad(index, 3) + '-' + pad(i, 3)
            });
        }
    });

    var callBackwhenDone = (function() {
        var total = forests.length;
        return function() {
            total = total-1;
            if (total < 1) callback();
        };
    })();

    var manager = this.getHttpManager();
    forests.forEach(function(forest) {
        forestNames.push(forest['forest-name']);
        manager.get({
            endpoint: '/manage/v2/forests/' + forest['forest-name']
        })
        .result(function(response) {
            if (response.statusCode === 404) {
                // forest does not already exist; create it
                logger.debug('creating forest ' + forest['forest-name']);
                manager.post({
                    endpoint : '/manage/v2/forests',
                    body : forest
                })
                .result(function(response) {
                    if (response.statusCode === 201) {
                        // yay. We're done with this one.
                        callBackwhenDone();
                    } else {
                        logger.error('Error when creating %s [Error %s]', forest, response.statusCode);
                        console.error(response.data);
                        process.exit(1);
                    }
               });
            } else if (response.statusCode === 200) {
                // Already exists, no need to create
                callBackwhenDone();
            } else {
                logger.error('Error when checking %s [Error %s]', forest, response.statusCode);
                console.error(response.data);
                process.exit(1);
            }
        });
    });
};

DBManager.removeForests = function(type, level, callback) {
    //check level value
    if (level && !/(full|config-only)/i.test(level)) {
        logger.error('Only full and config-only allowed for level parameter');
        process.exit(1);
    }
    var manager = this.getHttpManager();
    var settings = common.objectSettings('databases/' + type, this.env);
    var dbName = settings['database-name'];
    var dbPropsURL = '/manage/v2/databases/' + dbName + '/properties';

    logger.info('Removing ' + type + ' forests');

    // Ask for the database properties to get the list of forests
    manager.get({
        endpoint: dbPropsURL
    }).
    result(function(response) {
        if (response.statusCode === 200) {
            var forests = response.data.forest;
            if (forests) {
                forests.forEach(function(forest) {
                    logger.debug('detaching forest ' + forest);
                    manager.post({
                        endpoint: '/manage/v2/forests/' + forest,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: 'state=detach'
                    })
                    .result(function(response) {
                        logger.debug('deleting forest ' + forest);
                        manager.remove({
                            endpoint: '/manage/v2/forests/' + forest,
                            params: {
                                level: level
                            }
                        });
                    });
                });
            }
        } else if (response.statusCode === 404) {
            logger.debug('Database does not exist; skipping db removal');
        }
        if (callback)
            callback();
    });
};

