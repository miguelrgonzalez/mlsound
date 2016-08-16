#!/usr/bin/env node
var Promise = require('bluebird');
var database = require('../lib/database.js');
var program = require('commander');
var prompt = require('prompt');
var util = require('../lib/utils.js');

var logger = util.consoleLogger;

//Handle execution
program
    .option('-e, --env [environment]', 'Environment', 'local')
    .option('-v, --verbose', 'Verbose debug messages', 'false')
    .parse(process.argv);

logger.info('Bootstraping project into ' + program.env);

var dbManager = database.createDBManager(program.env);

prompt.message = 'mlsound'.red;
//prompt.override = dbManager.settings.connection;
prompt.start();
prompt.get(
    {
        properties : {
            'password' : {
                required : true,
                hidden: true
            }
        }
    },
    function(err, result) {
    dbManager.settings.connection.password = result.password;

    //groups
    dbManager.initializeGroups().then(function(msg) {
        logger.info(msg.green);
        //hosts
        return dbManager.initializeHosts();
    })
    .then(function(msg) {
        logger.info(msg.green);
        //forests
        return dbManager.initializeForests();
    }).then(function(msg) {
        logger.info(msg.green);
        //databases
        return dbManager.initializeDatabase('content');
    }).then(function(msg) {
        logger.info(msg.green);
        return dbManager.initializeDatabase('modules');
    }).then(function(msg) {
        logger.info(msg.green);
        //roles
        return dbManager.initializeRoles();
    }).then(function(msg) {
        logger.info(msg.green);
        //users
        return dbManager.initializeUsers();
    }).then(function(msg) {
        logger.info(msg.green);
        //Rest API
        return dbManager.initializeRestAPI();
    }).then(function(msg) {
        logger.info(msg.green);
        return dbManager.deployMimetypes();
    }).then(function(msg) {
        logger.info(msg.green);
        //update http server settings
        dbManager.updateServer('http').done(function() {
            prompt.message = 'mlsound'.green;
            prompt.start();
            prompt.get({
                properties : {
                    answer : {
                        description: 'Do you want to restart now [Y/N]?',
                        type: 'string',
                        pattern: /^[YN]$/,
                        required: true,
                        default: 'Y',
                        message : 'Only Y or N supported'
                    }
                }
            }, function(err, result) {
                if(result.answer === 'Y'){
                    dbManager.restartGroup().done(function(msg) {
                        logger.info(msg.green);
                        logger.info('Server group on ' + program.env + ' restarted successfully');
                    });
                }
            });
        });
    }).catch(function(err){
        logger.error(err);
        process.exit(1);
    });
});
