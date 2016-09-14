#!/usr/bin/env node
var common = require('mlsound').common;
var database = require('mlsound').database;
var util = require('mlsound').util;
var prompt = require('mlsound').prompt;
var program = require('mlsound').program;

program
    .option('-e, --env [environment]', 'Environment', 'local')
    .parse(process.argv);

var name = program.args;

tar settings = common.objectSettings('servers/http', program.env);

logger.info("Place here your custom command extension")
database.eval(settings["content-database"],
        { javascript : 'fn.currentDate();' }
).then(function(resp) {
    logger.info("The date at the server is " + resp[0].data.content);
});
