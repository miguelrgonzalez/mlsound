var Promise = require('bluebird');
var common = require('../../lib/common.js');
var util = require('../../lib/utils.js');
var logger = util.consoleLogger;

var DBManager = module.exports;

DBManager.restartGroup = function() {
    var that = this;
    var manager = this.getHttpManager();
    return new Promise(function(resolve, reject){
        //Issue command
        manager.post({
            endpoint: '/manage/LATEST/groups/' + that.httpSettings['group-name'],
            body: { 'operation' : 'restart-group'}
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 202) {
                    resolve("Group Restarted");
                }
                else {
                    logger.error(response.data);
                    reject('Error when restarting server group '+that.httpSettings['group-name']+' [Error '+response.statusCode+']');
                    //logger.error('Error when restarting server group %s [Error %s]',
                        //that.httpSettings['group-name'], response.statusCode);
                    //process.exit(1);
                }
            });
        });
    });
};


DBManager.initializeGroups = function() {
    var that = this;
    return new Promise(function(resolve, reject){
        that.initializeMultiObjects('groups', 'groups', 'group-name', undefined, undefined).then(function(msg){
            resolve(msg);
        });
    });
};


DBManager.initializeHosts = function() {
    var that = this;
    return new Promise(function(resolve, reject){
     that.initializeMultiObjects('hosts', 'hosts', 'host-name', undefined, undefined).then(function(msg){
        resolve(msg);
     });
    });
};

DBManager.initializeForests = function() {
    //See : http://docs.marklogic.com/REST/PUT/manage/v2/forests/[id-or-name]/properties
    var that = this;
    return new Promise(function(resolve, reject){
        var supported = ['enabled', 'updates-allowed', 'availability',
                        'rebalancer-enable', 'range', 'failover-enable',
                        'failover-host', 'failover-replica'];
        that.initializeMultiObjects('forests', 'forests', 'forest-name', supported, undefined).then(function(msg){
            resolve(msg);
        });
    });
};

DBManager.updateServer = function(type) {
    var UPDATE_SERVER_URL = '/manage/LATEST/servers/' + this.httpSettings['server-name'];
    var manager = this.getHttpManager();
    var settings = common.objectSettings('servers/' + type, this.env);
    return new Promise(function(resolve, reject){
        //Check if server exists
        manager.get({
            endpoint: UPDATE_SERVER_URL,
            params : { 'group-id' : settings['group-name'] }
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 200) {
                    manager.put(
                        {
                            endpoint : UPDATE_SERVER_URL + '/properties',
                            body : settings,
                            params : { 'group-id' : settings['group-name'] }
                    }).then(function(resp){
                        resp.result(function(response) {
                                if (response.statusCode === 202) {
                                    resolve('Rest API instance updated');
                                    //logger.info('Rest API instance updated');
                                } else if (response.statusCode === 204) {
                                    resolve('Server restart needed!');
                                } else {
                                    logger.error(response.data);
                                    reject('Error when updating Rest API instance [Error '+response.statusCode+']');
                                    //logger.error('Error when updating Rest API instance [Error %s]', response.statusCode);
                                    //process.exit(1);
                                }
                        });
                    });
                }
            });
        });
    });
};

DBManager.removeServer = function(type) {
    var SERVER_URL = '/manage/LATEST/servers/' + this.httpSettings['server-name'];
    var manager = this.getHttpManager();
    var that = this;
    var settings = common.objectSettings('servers/' + type, this.env);

    return new Promise(function(resolve, reject){
        var retMsg = "";
        //Check if server exists
        manager.get({
            endpoint: SERVER_URL,
            params : { 'group-id' : settings['group-name'] }
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 200) {
                    manager.remove(
                        {
                            endpoint : SERVER_URL,
                            params : { 'group-id' : settings['group-name'] }
                        }).then(function(resp) {
                            resp.result(function(response) {
                                if (response.statusCode === 202) {
                                    retMsg = 'HTTP server removed';
                                } else if (response.statusCode === 204) {
                                    retMsg = 'Server restart needed!';
                                } else {
                                    reject('Error when trying to remove app server ' +that.httpSettings['server-name']+' [Error '+response.statusCode+']');
                                    // logger.error('Error when trying to remove app server %s [Error %s]',
                                    //     that.httpSettings['server-name'], response.statusCode);
                                    logger.error(response.data);
                                    //process.exit(1);
                                }

                                resolve(retMsg);
                            });
                        });
                } else if (response.statusCode === 404) {
                    //No need to remove anything. Just finished
                    resolve(retMsg);
                }
            });
        });
    });
};

DBManager.buildForestsByHost = function(dbSettings) {

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
    return new Promise(function(resolve,reject){
        var callBackwhenDone = (function() {
            var total = forests.length;
            return function() {
                total = total-1;
                if (total < 1) resolve();
            };
        })();

        var manager = this.getHttpManager();
        forests.forEach(function(forest) {
            forestNames.push(forest['forest-name']);
            manager.get({
                endpoint: '/manage/LATEST/forests/' + forest['forest-name']
            }).then(function(resp) {
                resp.result(function(response) {
                    if (response.statusCode === 404) {
                        // forest does not already exist; create it
                        logger.debug('creating forest ' + forest['forest-name']);
                        manager.post({
                            endpoint : '/manage/LATEST/forests',
                            body : forest
                        }).then(function(resp) {
                            resp.result(function(response) {
                                if (response.statusCode === 201) {
                                    // yay. We're done with this one.
                                    callBackwhenDone();
                                } else {
                                    console.error(response.data);
                                    reject('Error when creating '+forest+' [Error '+response.statusCode+']');
                                    //logger.error('Error when creating %s [Error %s]', forest, response.statusCode);
                                    //process.exit(1);
                                }
                           });
                        });
                    } else if (response.statusCode === 200) {
                        // Already exists, no need to create
                        callBackwhenDone();
                    } else {
                        //logger.error('Error when checking %s [Error %s]', forest, response.statusCode);
                        console.error(response.data);
                        reject('Error when checking '+forest+' [Error '+response.statusCode+']');
                        //process.exit(1);
                    }
                });
            });
        });
    });

};

DBManager.removeForests = function(type, level) {
    var that = this;
    //logger.info('Removing ' + type + ' forests');
    return new Promise(function(resolve, reject){
        //check level value
        if (level && !/(full|config-only)/i.test(level)) {
            reject('Only full and config-only allowed for level parameter');
            //logger.error('Only full and config-only allowed for level parameter');
            //process.exit(1);
        }
        var manager = that.getHttpManager();
        var settings = common.objectSettings('databases/' + type, that.env);
        var dbName = settings['database-name'];
        var dbPropsURL = '/manage/LATEST/databases/' + dbName + '/properties';
    // Ask for the database properties to get the list of forests
        manager.get({
            endpoint: dbPropsURL
        }).then(function(resp) {
            resp.result(function(response) {
                if (response.statusCode === 200) {
                    var forests = response.data.forest;
                    if (forests) {
                        forests.forEach(function(forest) {
                            //logger.debug('detaching forest ' + forest);
                            manager.post({
                                endpoint: '/manage/LATEST/forests/' + forest,
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                body: 'state=detach'
                            }).then(function(resp) {
                                resp.result(function(response) {
                                    //logger.debug('deleting forest ' + forest);
                                    manager.remove({
                                        endpoint: '/manage/LATEST/forests/' + forest,
                                        params: {
                                            level: level
                                        }
                                    });
                                });
                            });
                        });
                    }
                } else if (response.statusCode === 404) {
                    logger.warning('Database does not exist; skipping db removal');
                }
                resolve(type + ' forests removed');
            });
        });
    });

};

