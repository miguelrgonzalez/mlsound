var common = require('../../lib/common.js');
var util = require('../../lib/utils.js');
var logger = util.consoleLogger;

var DBManager = module.exports;

DBManager.restartGroup = function(callback) {
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
            logger.error('Error when restarting server group %s [Error %s]',
                that.httpSettings["group-name"], response.statusCode);
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
                            logger.error("Error when updating Rest API instance [Error %s]", response.statusCode);
                            logger.error(response.data);
                            process.exit(1);
                        }

                        if (callback)
                            callback();
                });
        }
    });
};

DBManager.removeServer = function(type, callback) {
    var SERVER_URL = '/manage/v2/servers/' + this.httpSettings["server-name"];
    var manager = this.getHttpManager();
    var that = this;
    var settings = common.objectSettings('servers/' + type, this.env);
    //Check if server exists
    manager.get({
        endpoint: SERVER_URL,
        params : { "group-id" : settings["group-name"] }
    }).
    result(function(response) {
        if (response.statusCode === 200) {
            manager.remove(
                {
                    endpoint : SERVER_URL,
                    params : { "group-id" : settings["group-name"] }
                }).result(function(response) {
                        if (response.statusCode === 202) {
                            logger.info('HTTP server removed');
                        } else if (response.statusCode === 204) {
                            logger.info('Server restart needed!');
                        } else {
                            logger.error("Error when trying to remove app server %s [Error %s]",
                                that.httpSettings["server-name"], response.statusCode);
                            logger.error(response.data);
                            process.exit(1);
                        }

                        if (callback)
                            callback();
                });
        } else if (response.statusCode === 404) {
            //No need to remove anything. Just finished
            if (callback)
                callback();
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

DBManager.removeForests = function(level, callback) {
    //check level value
    if (level && !/(full|config-only)/i.test(level)) {
        logger.error('Only full and config-only allowed for level parameter');
        process.exit(1);
    };
    this.removeMultiObjects('forests', 'forests', 'forest-name', { 'level' : level}, callback);
};

