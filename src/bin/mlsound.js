#!/usr/bin/env node
var colors = require('colors');
var packjson = require('../../package.json');
var program = require('commander');
var path = require('path');
var readlink = require('graceful-readlink').readlinkSync;
var spawn = require('child_process').spawn;
var fs = require('fs');

console.log(('mlsound version ' + packjson.version).green);

//Monkey-patch original commader method to allow for user custom commands
function exists(file) {
  try {
    if (fs.statSync(file).isFile()) {
      return true;
    }
  } catch (e) {
    return false;
  }
}

program.Command.prototype.executeSubCommand = function(argv, args, unknown) {
  var dirname = path.dirname;
  var basename = path.basename;

  args = args.concat(unknown);

  if (!args.length) this.help();
  if ('help' == args[0] && 1 == args.length) this.help();

  // <cmd> --help
  if ('help' == args[0]) {
    args[0] = args[1];
    args[1] = '--help';
  }

  // executable
  var f = argv[1];
  // name of the subcommand, link `pm-install`
  var bin = basename(f, '.js') + '-' + args[0];


  // In case of globally installed, get the base dir where executable
  //  subcommand file should be located at
  var baseDir
    , link = readlink(f);

  // when symbolink is relative path
  if (link !== f && link.charAt(0) !== '/') {
    link = path.join(dirname(f), link)
  }
  baseDir = dirname(link);

  // prefer local `./<bin>` to bin in the $PATH
  var localBin = path.join(baseDir, bin);

  var userExtended =  path.join( './bin/' + bin);

  // whether bin file is a js script with explicit `.js` extension
  var isExplicitJS = false;
  if (exists(userExtended + '.js')) {
    bin = userExtended + '.js';
    isExplicitJS = true;
  } else if (exists(userExtended)) {
    bin = localBin;
  } else if (exists(localBin + '.js')) {
    bin = localBin + '.js';
    isExplicitJS = true;
  } else if (exists(localBin)) {
    bin = localBin;
  }

  args = args.slice(1);

  var proc;
  if (process.platform !== 'win32') {
    if (isExplicitJS) {
      args.unshift(bin);
      // add executable arguments to spawn
      args = (process.execArgv || []).concat(args);

      proc = spawn('node', args, { stdio: 'inherit', customFds: [0, 1, 2] });
    } else {
      proc = spawn(bin, args, { stdio: 'inherit', customFds: [0, 1, 2] });
    }
  } else {
    args.unshift(bin);
    proc = spawn(process.execPath, args, { stdio: 'inherit'});
  }

  proc.on('close', process.exit.bind(process));
  proc.on('error', function(err) {
    if (err.code == "ENOENT") {
      console.error('\n  %s(1) does not exist, try --help\n', bin);
    } else if (err.code == "EACCES") {
      console.error('\n  %s(1) not executable. try chmod or run with root\n', bin);
    }
    process.exit(1);
  });

  // Store the reference to the child process
  this.runningCommand = proc;
};

program
    .version(packjson.version)
    .command('create [name]', 'Create project folder and scaffolding files')
    .command('add [module]', 'Add configuration files for [cpf|triggers|mimetypes|alerts|database-rebalancer]')
    .command('bootstrap', 'Bootstrap project')
    .command('wipe', 'Wipe project')
    .command('deploy [module]', 'Deploy [code|data|schemas|triggers|cpf]')
    .command('clean [module]', 'Clean [code|data|schemas]')
    .command('restart', 'Restart server group');

//Add user custom commands
try {
    fs.readdirSync('./bin').map(function(file) {
                var re = new RegExp('(^bin/mlsound-|mlsound-|\.js$)', 'g');
                return file.replace(re, '');
    }).forEach(function(c) {
        program.command(c, 'custom command');
    });
} catch (err) {
  // Not really an error
  // The user didn't extend the framework
}

program
    .parse(process.argv);
