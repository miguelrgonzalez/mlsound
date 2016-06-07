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
                if(folder){
                    logger.info(folder + ' Created'.green);
                } else {
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
    settings[property] = value;
    fs.writeFileSync(file ,JSON.stringify(settings, null, 4), 'utf8');
};

var addFileHeader = function(file, header) {
    fs.readFileAsync(file, 'utf8').then(function(fileContent){
        fs.writeFileAsync(file, header + '\n' + fileContent, 'utf8').done(function(){
        });
    }).catch(function(err){
        logger.error(err);
    });
};

var hostname = function(name) {
    //ipv4 and ipv6
    var ipRegex = /((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))/;
    //ip
    if (ipRegex.test(name)) {
        logger.info('Reverse lookup on: ' + name);
        return dns.lookupServiceAsync(name, 8001);
    //localhost
    } if (/^localhost$/i.test(name)) {
        logger.info('Reverse lookup on: ' + name);
        return dns.lookupAsync(name).
               then(function(ip) {
                   //this should be always 127.0.0.1
                   return dns.lookupServiceAsync(ip, 8001);
               });
    //name
    } else {
        return Promise.try(function() { return name.trim() });
    }
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
        //Not efficient, but readable and easy to maintain

        changePropertyValue(path.join(name, 'settings/base-configuration/servers/http.json'), 'server-name', name);

        changePropertyValue(path.join(name, 'settings/base-configuration/servers/http.json'), 'modules-database', name + '-modules');

        changePropertyValue(path.join(name, 'settings/base-configuration/servers/http.json'),  'content-database', name + '-content');

        changePropertyValue(path.join(name, 'settings/base-configuration/servers/http.json'), 'default-user', name + '-application-user');

        changePropertyValue(path.join(name, 'settings/base-configuration/databases/content.json'), 'database-name', name + '-content');

        changePropertyValue(path.join(name, 'settings/base-configuration/databases/content.json'), 'forest', [name + '-content-01']);

        changePropertyValue(path.join(name, 'settings/base-configuration/databases/modules.json'), 'database-name', name + '-modules');

        changePropertyValue(path.join(name, 'settings/base-configuration/databases/modules.json'), 'forest', [name + '-modules-01']);

        changePropertyValue(path.join(name, 'settings/base-configuration/forests/content-01.json'), 'forest-name', name + '-content-01');

        changePropertyValue(path.join(name, 'settings/base-configuration/forests/modules-01.json'), 'forest-name', name + '-modules-01');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/roles/role-01.json'), 'role-name', name + '-application-role');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/roles/role-01.json'),  'description', name  + ' application role');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/users/user-01.json'), 'user-name', name + '-application-user');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/users/user-01.json'),  'description', name + ' application user');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/users/user-01.json'), 'role', [name + '-application-role']);

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
                }
                /*,
                password : {
                    description: 'Marklogic host password?',
                    type: 'string',
                    required: true,
                    default: 'password',
                    hidden:true,
                    message : 'This host will be used to connect to your local MarkLogic instance'
                }*/
            }
        }).then(function(result, err) {
                var settings = JSON.parse(JSON.minify(
                            fs.readFileSync(path.join(name,'settings/environments/local/connection.json'), 'utf8')));
                //Adding file headers
                addFileHeader(path.join(name, 'settings/base-configuration/databases/content.json'),
                        '//See http://docs.marklogic.com/REST/PUT/manage/v2/databases/[id-or-name]/properties\n' +
                        '//for a complete list of possible parameters\n');

                addFileHeader(path.join(name, 'settings/base-configuration/databases/modules.json'),
                        '//See http://docs.marklogic.com/REST/PUT/manage/v2/databases/[id-or-name]/properties\n' +
                        '//for a complete list of possible parameters\n');

                addFileHeader(path.join(name, 'settings/base-configuration/servers/http.json'),
                        '//See http://docs.marklogic.com/REST/PUT/manage/v2/servers/[id-or-name]/properties\n' +
                        '//for a complete list of possible parameters\n');

                addFileHeader(path.join(name, 'settings/base-configuration/security/roles/role-01.json'),
                        '//See http://docs.marklogic.com/REST/PUT/manage/v2/roles/[id-or-name]/properties\n'+
                        '//for a complete list of possible parameters\n');

                addFileHeader(path.join(name, 'settings/base-configuration/security/users/user-01.json'),
                        '//See http://docs.marklogic.com/REST/PUT/manage/v2/users/[id-or-name]/properties\n'+
                        '//for a complete list of possible parameters\n');

                addFileHeader(path.join(name, 'settings/base-configuration/forests/content-01.json'),
                        '//See http://docs.marklogic.com/REST/PUT/manage/v2/forests/[id-or-name]/properties\n'+
                        '//for a complete list of possible parameters\n');

                addFileHeader(path.join(name, 'settings/base-configuration/forests/modules-01.json'),
                        '//See http://docs.marklogic.com/REST/PUT/manage/v2/forests/[id-or-name]/properties\n'+
                        '//for a complete list of possible parameters\n');

                addFileHeader(path.join(name, 'settings/base-configuration/connection.json'),
                        '//Management API connection details\n');

                fs.writeFileSync(path.join(name,'settings/environments/local/connection.json'), JSON.stringify(settings, null, 4), 'utf8');
                //MarkLogic refers to machines via hostnames
                hostname(result.host)
                .then(function(hostname) {
                    settings.connection.host = hostname;
                    //write file back
                    if(name != null && name.trim() != "") {
                        changePropertyValue(path.join(name, 'settings/environments/local/forests/content-01.json'),  'host', hostname);

                        changePropertyValue(path.join(name, 'settings/environments/local/forests/modules-01.json'), 'host', hostname);

                        changePropertyValue(path.join(name, 'settings/environments/local/hosts/host-01.json'), 'host-name', hostname);
                    } else {
                        logger.error("Error while determining hostname");
                    }


                    logger.warning('Project created!');
                    logger.info('Review project/connection settings and adjust as required');
                })
               .catch(function(err){
                   if(err!=null) logger.error(err);
               });

        });
    })
    .catch(function(err){
        logger.error('Error when creating project: ' + err);
    });

