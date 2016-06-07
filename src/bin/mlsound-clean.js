#!/usr/bin/env node
var common = require('../lib/common.js');
var database = require('../lib/database.js');
var program = require('commander');
var util = require('../lib/utils.js');
var logger = util.consoleLogger;
var prompt = require('prompt');

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

prompt.message = 'mlsound'.red;
prompt.override = dbManager.settings.connection;
prompt.start();
prompt.get(['password'], function(err, result) {
    dbManager.settings.connection.password = result.password;

    var actions = {
        'code' : function() {
            var settings = common.objectSettings('servers/http', program.env);
            dbManager.databaseOperation('clear-database', settings['modules-database'])
                .catch(function(err){
                    logger.error(err);
                })
                .done(function(msg) {
                    logger.info(msg + ' successfully cleaned');
                });
        },

        'data' : function() {
            var settings = common.objectSettings('servers/http', program.env);
            dbManager.databaseOperation('clear-database', settings['content-database'])
                .catch(function(err){
                    logger.error(err);
                })
                .done(function(msg) {
                    logger.info(msg + ' successfully cleaned');
                });
        },

        'schemas' : function() {
            var settings = common.objectSettings('databases/content', program.env);
            dbManager.databaseOperation('clear-database', settings['schema-database'])
                .catch(function(err){
                    logger.error(err);
                })
                .done(function(msg) {
                    logger.info(msg + ' successfully cleaned');
                });
        }
    };

    actions[name]();
});
