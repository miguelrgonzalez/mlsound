#!/usr/bin/env node
var common = require('mlsound').common;
var database = require('mlsound').database;
var util = require('mlsound').util;
var prompt = require('mlsound').prompt;
var program = require('mlsound').program;
var logger = util.consoleLogger;

program
    .option('-e, --env [environment]', 'Environment', 'local')
    .parse(process.argv);

var name = program.args;

var settings = common.objectSettings('servers/http', program.env);

var dbManager = database.createDBManager(program.env);

logger.info("Place here your custom command extension")
dbManager.eval(settings["content-database"],
    'javascript= fn.currentDateTime()'
).then(function(resp) {
    logger.info("The date at the server is " + resp[0].data.content);
});
