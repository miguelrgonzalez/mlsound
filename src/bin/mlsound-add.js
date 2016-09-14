#!/usr/bin/env node
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var ncp = Promise.promisifyAll(require('ncp'));
var path = require('path');
var program = require('commander');
var util = require('../lib/utils.js');
var logger = util.consoleLogger;

//Handle execution
program
    .option('-e, --env [environment]', 'Environment', 'local')
    .option('-v, --version [version]', 'Marklogic version', '8')
    .parse(process.argv);

var name = program.args;

if (!/(triggers|cpf|mimetypes|alerts|database-rebalancer)/i.test(name)) {
    logger.error('Only cpf, triggers, alerts, mimetypes and database-rebalancer are supported');
    process.exit(1);
}

fs.accessAsync('./settings/base-configuration/connection.json', fs.F_OK)
.then(function() {
    ncp.ncpAsync(
        path.join(path.resolve(__dirname), '../extras/base-configuration/' + name),
        './settings/base-configuration/' + name,
        {
            //don't overwrite destination files if they do exist
            clobber : false
        }
    ).then(function(){
        console.log(name + " added to project");
    }).finally(function() {
        ncp.ncpAsync(
            path.join(path.resolve(__dirname), '../extras/src/app/' + name),
            './src/app/' + name,
            {
                //don't overwrite destination files if they do exist
                clobber : false
            }
        ).catch(function(err) {
            //ignore error. There might no code related with this module
        });
    });
})
.catch(function(err){
        logger.error("You must run this command from inside a project");
});
