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
        dbManager.removeServer('http', function() {
            //wait 3 seconds before trying to do anything else
            //removing an application server seems to have an impact on server
            //response times. Without waiting, it'll throw either 500 or 503 errors
            logger.warning('Waiting for server restart');
            setTimeout(function() {
                dbManager.removeForests('content', 'full', function() {
                    dbManager.removeForests('modules', 'full', function() {
                        dbManager.removeDatabase('content', undefined, function() {
                            dbManager.removeDatabase('modules', undefined, function() {
                                dbManager.removeUsers(function() {
                                    dbManager.removeRoles(function() {
                                        logger.info('Project wiped!');
                                    });
                                });
                            });
                        });
                    });
                });
            }, 3000);
        });
    }
});

