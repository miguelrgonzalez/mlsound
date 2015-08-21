#!/usr/bin/env node
var program = require('commander');
var database = require('../lib/database.js');
var util = require('../lib/utils.js');
var logger = util.consoleLogger;

var databaseClient = function() {
    var client = null;
    return function() {
        if (client) {
            return client;
        } else {
            client = marklogic.createDatabaseClient(SETTINGS.connection);
            return client;
        }
    }();
};

//Handle execution
program
    .option('-e, --env [environment]', 'Environment', 'local')
    .option('-v, --version [version]', 'Marklogic version', '8')
    .parse(process.argv);

logger.info('Restarting environment ' + program.env);

var dbManager = database.createDBManager(program.env);
dbManager.restartGroup (function() {
    logger.info('Server group on ' + program.env + ' restarted successfully');
});
