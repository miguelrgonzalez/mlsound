#!/usr/bin/env node
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

//groups
dbManager.initializeGroups(function() {
    //hosts
    dbManager.initializeHosts(function() {
    //forests
        dbManager.initializeForests(function() {
            //databases
            dbManager.initializeDatabase('content', function() {
                dbManager.initializeDatabase('modules', function() {
                    //roles
                    dbManager.initializeRoles(function() {
                        //users
                        dbManager.initializeUsers(function() {
                            //Rest API
                            dbManager.initializeRestAPI(function() {
                                //update http server settings
                                dbManager.updateServer('http', function() {
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
                                            dbManager.restartGroup (function() {
                                                logger.info('Server group on ' + program.env + ' restarted successfully');
                                            });
                                        }
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
