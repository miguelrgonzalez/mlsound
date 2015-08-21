#!/usr/bin/env node
var fs = require('fs');
var mkdirp = require('mkdirp');
var ncp = require('ncp').ncp;
var path = require('path');
var program = require('commander');
var prompt = require('prompt');
var util = require('../lib/utils.js');
var logger = util.consoleLogger;

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
  'test'
]).forEach(
        function (folder) {
            mkdirp(path.join(name, folder), function(err) {
                if (err) {
                    logger.error(err);
                    process.exit(1);
                }
            });
        }
);

var changePropertyValue = function(file, property, value) {
    var settings = JSON.parse(JSON.minify(fs.readFileSync(file, 'utf8')));
    settings[property] = value;
    //write file back
    fs.writeFileSync(file ,JSON.stringify(settings, null, 4), 'utf8');
};

var addFileHeader = function(file, header) {
    var fileContent = fs.readFileSync(file, 'utf8');
    //write file back
    fs.writeFileSync(file , header + '\n' + fileContent, 'utf8');
};

//copy default configuration files
ncp.limit = 16;
ncp(path.join(path.resolve(__dirname), '../templates/'),
    path.join(name, '.'),
    {
        //don't overwrite destination files if they do exist
        clobber : false
    },
    //callback
    function (err) {
         if (err) {
           return logger.error('When copying template files ' + err);
           process.exit(1);
         }

        //Change project name dependant properties
        //Not efficient, but readable and easy to maintain

        changePropertyValue(path.join(name, 'settings/base-configuration/servers/http.json'),
                            'server-name', name);

        changePropertyValue(path.join(name, 'settings/base-configuration/servers/http.json'),
                            'modules-database', name + '-modules');

        changePropertyValue(path.join(name, 'settings/base-configuration/servers/http.json'),
                            'content-database', name + '-content');

        changePropertyValue(path.join(name, 'settings/base-configuration/servers/http.json'),
                            'default-user', name + '-application-user');

        changePropertyValue(path.join(name, 'settings/base-configuration/databases/content.json'),
                            'database-name', name + '-content');

        changePropertyValue(path.join(name, 'settings/base-configuration/databases/content.json'),
                            'forest', [name + '-content-01']);

        changePropertyValue(path.join(name, 'settings/base-configuration/databases/modules.json'),
                            'database-name', name + '-modules');

        changePropertyValue(path.join(name, 'settings/base-configuration/databases/modules.json'),
                            'forest', [name + '-modules-01']);

        changePropertyValue(path.join(name, 'settings/base-configuration/forests/content-01.json'),
                            'forest-name', name + '-content-01');

        changePropertyValue(path.join(name, 'settings/base-configuration/forests/modules-01.json'),
                            'forest-name', name + '-modules-01');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/roles/role-01.json'),
                            'role-name', name + '-application-role');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/roles/role-01.json'),
                            'description', name  + ' application role');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/users/user-01.json'),
                            'user-name', name + '-application-user');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/users/user-01.json'),
                            'description', name + ' application user');

        changePropertyValue(path.join(name, 'settings/base-configuration/security/users/user-01.json'),
                            'role', [name + '-application-role']);

        logger.warning('Please enter below the '.grey +
                    'MarkLogic'.red +
                    ' host name for your local environment'.grey);

        prompt.message = 'mlsound'.green;
        prompt.start();
        prompt.get({
            properties : {
                host : {
                    description: 'Marklogic host name?',
                    type: 'string',
                    required: true,
                    default: 'localhost',
                    message : 'This host will be used to configure your local environment'
                }
            }
        }, function(err, result) {
                var settings = JSON.parse(JSON.minify(
                            fs.readFileSync(path.join(name,'settings/environments/local/connection.json'), 'utf8')));
                settings.connection.host = result.host;
                //write file back
                fs.writeFileSync(path.join(name,'settings/environments/local/connection.json'),
                    JSON.stringify(settings, null, 4), 'utf8');

                changePropertyValue(path.join(name, 'settings/environments/local/forests/content-01.json'),
                                    'host', result.host);

                changePropertyValue(path.join(name, 'settings/environments/local/forests/modules-01.json'),
                                    'host', result.host);

                changePropertyValue(path.join(name, 'settings/environments/local/hosts/host-01.json'),
                                    'host-name', result.host);


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

                addFileHeader(path.join(name, 'settings/environments/local/connection.json'),
                        '//Management API connection details\n');

                logger.warning(' Done!');
        });
    }
);
