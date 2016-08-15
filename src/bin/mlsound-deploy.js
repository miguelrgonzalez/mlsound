#!/usr/bin/env node
var Promise = require('bluebird');
var common = require('../lib/common.js');
var database = require('../lib/database.js');
var program = require('commander');
var util = require('../lib/utils.js');
var logger = util.consoleLogger;
var prompt = Promise.promisifyAll(require('prompt'));

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
        logger.info('Deploying application code into ' + program.env);
        var settings = common.objectSettings('servers/http', program.env);
        dbManager.loadDocuments('src/app', settings['modules-database'])
        .then(function(msg) {
            logger.info(msg.green);
            return dbManager.deployRestExtensions('src/rest-api/extensions', database);
        })
        .then(function(msg) {
            logger.info(msg.green);
            return dbManager.deployTransformations('src/rest-api/transformations', database);
        })
        .then(function(msg) {
            logger.info(msg.green);
            return dbManager.deployOptions('src/rest-api/config/query', database);
        })
        .then(function(msg) {
            logger.info(msg.green);
            return dbManager.deployProperties('src/rest-api/config/properties', database);
        })
        .then(function(msg) {
            logger.info(msg.green);
        })
        .catch(function(err){
            logger.error(err);
            process.exit(1);
        });
    },

    'data' : function() {
        var settings = common.objectSettings('servers/http', program.env);
        dbManager.loadDocuments('data', settings['content-database'])
        .then(function(msg) {
            logger.info('Data ' +msg);
        }).catch(function(err){
            logger.error(err);
            process.exit(1);
        });
    },

    'schemas' : function() {
        var settings = common.objectSettings('databases/content', program.env);
        dbManager.loadDocuments('schemas', settings['schema-database'])
        .then(function(msg) {
            logger.info('Schemas ' + msg);
        }).catch(function(err){
            logger.error(err);
            process.exit(1);
        });
    }
};

actions[name]();
