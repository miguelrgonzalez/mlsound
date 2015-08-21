#!/usr/bin/env node
var common = require('../lib/common.js');
var database = require('../lib/database.js');
var program = require('commander');
var util = require('../lib/utils.js');
var logger = util.consoleLogger;

program
    .option('-e, --env [environment]', 'Environment', 'local')
    .option('-v, --verbose', 'Verbose debug messages', 'false')
    .parse(process.argv);

var name = program.args;

if (!/(code|data|schemas)/i.test(name)) {
    logger.error('Only code, data or schemas are supported');
    process.exit(1);
}

var dbManager = database.createDBManager(program.env);

var actions = {
    'code' : function() {
        var settings = common.objectSettings('servers/http', program.env);
        dbManager.databaseOperation('clear-database', settings['modules-database'],
                function() {
                    logger.info('%s successfully cleaned', settings['modules-database']);
                });
    },

    'data' : function() {
        var settings = common.objectSettings('servers/http', program.env);
        dbManager.databaseOperation('clear-database', settings['content-database'],
                function() {
                    logger.info('%s successfully cleaned', settings['content-database']);
                });
    },

    'schemas' : function() {
        var settings = common.objectSettings('databases/content', program.env);
        dbManager.databaseOperation('clear-database', settings['schema-database'],
                function() {
                    logger.info('%s successfully cleaned', settings['schema-database']);
                });
    }
};

actions[name]();
