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

logger.info('Wiping project at ' + program.env);

prompt.message = 'mlsound'.green;
prompt.start();
prompt.get({
    properties : {
        answer : {
            description: 'Are you sure you want to completely wipe the project [Y/N]?',
            type: 'string',
            pattern: /^[YN]$/,
            required: true,
            default: 'Y',
            message : 'Only Y or N supported'
        }
    }
}, function(err, result) {
    if(result.answer === 'Y'){
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
                dbManager.removeServer('http').then(function(msg) {
                    logger.info(msg);
                    //wait 3 seconds before trying to do anything else
                    //removing an application server seems to have an impact on server
                    //response times. Without waiting, it'll throw either 500 or 503 errors
                    logger.warning('Waiting for server restart');
                    Promise.delay(3000).then(function(){
                        Promise.join(
                            dbManager.removeForests('content', 'full'),
                            dbManager.removeForests('modules', 'full'),
                            dbManager.removeDatabase('content', undefined),
                            dbManager.removeDatabase('modules', undefined),
                            dbManager.removeUsers(),
                            dbManager.removeRoles(),
                            function(contentForests, modulesForests, contentDb, modulesDb, users, roles){
                                logger.info(contentForests.green);
                                logger.info(modulesForests.green);
                                logger.info(contentDb.green);
                                logger.info(modulesDb.green);
                                logger.info(users.green);
                                logger.info(roles.green);
                            })
                        .done(function(){
                            logger.info('Project wiped!');
                        });
                    });
                }).catch(function(msg){
                    logger.error(msg);
                    process.exit(1);
                });
        });
    }
});

