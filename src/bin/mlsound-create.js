#!/usr/bin/env node
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var mkdirp = Promise.promisifyAll(require('mkdirp'));
var ncp = Promise.promisifyAll(require('ncp'));
var path = require('path');
var program = require('commander');
var prompt = Promise.promisifyAll(require('prompt'));
var util = require('../lib/utils.js');
var logger = util.consoleLogger;
var dns = Promise.promisifyAll(require('dns'));

JSON.minify = require('node-json-minify');

program.parse(process.argv);

if(!program.args.length) {
    logger.error('Project name is required');
    process.exit(1);
}

//assuming only one argument has been passed
var name = program.args[0];
logger.info('Creating project ' + name);

//create project folders
([
  'data',
  'test',
  'schemas'
]).forEach(
        function (folder) {
            mkdirp.mkdirpAsync(path.join(name, folder)).then(function(folder, err) {
                if(!folder){
                    logger.warning('Project folder already exists.');
                }
            }).catch(function(err){
                    logger.error(err);
                    process.exit(1);
            });
        }
);

var changePropertyValue = function(file, property, value) {
    var settings = JSON.parse(JSON.minify(fs.readFileSync(file, 'utf8')));
    var path = property.split('.');
    var t = settings;
    for(var i=0; i < path.length-1; i ++) {
        t = t[path[i]];
    }
    t[path[path.length -1]] = value;
    fs.writeFileSync(file ,JSON.stringify(settings, null, 4), 'utf8');
};


//copy default configuration files
ncp.ncp.limit = 16;
ncp.ncpAsync(path.join(path.resolve(__dirname), '../templates/'),
    path.join(name, '.'),
    {
        //don't overwrite destination files if they do exist
        clobber : false
    }).then(function(){
        //Change project name dependant properties
        changePropertyValue(path.join(name, 'settings/base-configuration/connection.json'), 'global-values.%%APP-NAME%%', name);

        logger.warning('Please enter below the '.white +
                    'MarkLogic'.red +
                    ' host name for your local environment'.white);

        prompt.message = 'mlsound'.green;
        prompt.start();
        prompt.getAsync({
            properties : {
                host : {
                    description: 'Marklogic host name?',
                    type: 'string',
                    required: true,
                    default: 'localhost',
                    message : 'This host will be used to configure your local environment'
                },
                password : {
                    description: 'Marklogic host password?',
                    type: 'string',
                    required: true,
                    default: 'password',
                    hidden:true,
                    message : 'This host will be used to connect to your local MarkLogic instance'
                }
            }
        }).then(function(result, err) {
                changePropertyValue(path.join(name, 'settings/environments/local/connection.json'), 'connection.password', result.password);
                //write file back
                if(name != null && name.trim() != "") {
                    changePropertyValue(path.join(name, 'settings/base-configuration/connection.json'), 'connection.host', result.host);
                    changePropertyValue(path.join(name, 'settings/base-configuration/connection.json'), 'global-values.%%HOSTNAME%%', result.host);

                    changePropertyValue(path.join(name, 'settings/environments/local/connection.json'), 'connection.host', result.host);
                    changePropertyValue(path.join(name, 'settings/environments/local/connection.json'), 'global-values.%%HOSTNAME%%', result.host);
                } else {
                    logger.error("Error while determining hostname");
                }

                logger.warning('Project created!');
                logger.info('Review project/connection settings and adjust as required');
        });
    })
    .catch(function(err){
        logger.error('Error when creating project: ' + err);
    });

