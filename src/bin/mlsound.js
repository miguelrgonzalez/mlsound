#!/usr/bin/env node
var colors = require('colors');
var packjson = require('../../package.json');
var program = require('commander');

console.log(('mlsound version ' + packjson.version).green);

program
    .version(packjson.version)
    .command('create [name]', 'Create project folder and scaffolding files')
    .command('bootstrap', 'Bootstrap project')
    .command('wipe', 'Wipe project')
    .command('deploy [module]', 'Deploy [code|data|schemas|triggers]')
    .command('clean [module]', 'Clean [code|data|schemas]')
    .command('restart', 'Restart server group')
    .parse(process.argv);
