#!/usr/bin/env node
var Promise = require('bluebird');
var common = require('../lib/common.js');
var database = require('../lib/database.js');
var fs = Promise.promisifyAll(require("fs"));
var path = require("path");
var program = require('commander');
var prompt = Promise.promisifyAll(require('prompt'));
var util = require('../lib/utils.js');
var logger = util.consoleLogger;

program
    .option('-e, --env [environment]', 'Environment', 'local')
    .option('-v, --verbose', 'Verbose debug messages', 'false')
    .parse(process.argv);

var name = program.args;

if (!/(code|data|schemas|cpf|triggers)/i.test(name)) {
    logger.error('Only code, data, triggers, cpf or schemas are supported');
    process.exit(1);
}

var dbManager = database.createDBManager(program.env);
var settings = common.objectSettings('servers/http', program.env);

var actions = {
    'code' : function() {
        logger.info('Deploying application code into ' + program.env);
        fs.readdirAsync('./src')
        .map(function(file) {
            return path.join('./src', file);
        })
        .filter(function(file) {
            //Load everything except the rest api files
            return file != "src/rest-api" && fs.statSync(file).isDirectory();
        })
        .then(function(dirs) {
            //need to load all folders
            folders = [];
            dirs.forEach(function(folder) {
                folders.push(dbManager.loadDocuments('src', folder, settings['modules-database']));
            });
            return Promise.all(folders);
        })
        .then(function(msg) {
            logger.info("Code deployed".green);
            return dbManager.deployRestExtensions('src/rest-api/extensions');
        })
        .then(function(msg) {
            logger.info(msg.green);
            return dbManager.deployTransformations('src/rest-api/transformations');
        })
        .then(function(msg) {
            logger.info(msg.green);
            return dbManager.deployOptions('src/rest-api/config/query');
        })
        .then(function(msg) {
            logger.info(msg.green);
            return dbManager.deployProperties('src/rest-api/config/properties');
        })
        .then(function(msg) {
            logger.info(msg.green);
        })
        .catch(function(err){
            logger.error(err);
            process.exit(1);
        });
    },

    'triggers' : function() {
        dbManager.deployTriggers(settings['content-database'])
        .then(function(msg) {
            logger.info(msg.green);
        }).catch(function(err){
            logger.error(err);
            process.exit(1);
        });
    },

    'cpf' : function() {
        dbManager.deployCPF(settings['content-database'])
        .then(function(msg) {
            logger.info(msg.green);
        }).catch(function(err){
            logger.error(err);
            process.exit(1);
        });
    },

    'data' : function() {
        dbManager.loadDocuments('data', 'data', settings['content-database'])
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
