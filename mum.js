#!/usr/bin/env node

'use strict';
const events = require('events');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const extend = require('extend');
const mkdirp = require('mkdirp');
const http = require('http');
const semver = require('semver');
const os = require('os');
const URL = require('url');
const child_process = require('child_process');
const lib = require('./lib.js');
const util = require('./util.js');
const clog = lib.clog;
const permaclog = lib.clog;

var packageConfigFilePath = __dirname+'/package.json';
var packageConfig;
// Get version number from package.json
try {
    packageConfig = JSON.parse(fs.readFileSync(packageConfigFilePath));
} catch(e) {
    permaclog('Your Modern Update Manager (mum) installation is corrupt.\nUnable to initialize your preferences file because we cannot read the '+packageConfigFilePath+' file.\nThat file should be part of the mum-x.y.z.tgz package file you downloaded.');
    process.exit(0);
}

// ============================================================
// ============================================================
// ------------------- PROPS SETUP ----------------------------
// ============================================================
// ============================================================

var props = {
    mum: new events.EventEmitter(),
    appDataPath: os.homedir()+'/.mum',
    preferences: null,
    packageConfig: packageConfig
};
props.appTmpPath = props.appDataPath+'/tmp';
props.appPrefsPath = props.appDataPath+'/preferences.json';

mkdirp.sync(props.appTmpPath); // initialize Mum application data and tmp directories.
lib.initializePreferences(props.appPrefsPath);
props.preferences = lib.readPreferencesFromDisk(props.appPrefsPath);

props.prompter = new events.EventEmitter();

// ============================================================
// ============================================================
// ------------------- END PROPS SETUP ------------------------
// ============================================================
// ============================================================

//lib.clearTerminal();

const commands = {
    help: [],
    install: [
        {
            name: 'source'
            // other things will be added here like:
            // validate: function() {}
            // format: function() {} (or clean or set)
        },
        {
            // The base install path for the target repository
            name: 'installationDirectory',
            default: '.'
        },
        {
            name: 'clean',
            default: false
        }
    ],
    update: [],
    debug: []
};

// Parse the command line arguments/commands
var command = lib.readCommandInput(commands);

switch (command.name) {
    case 'help':
        // todo - write complete help docs
        permaclog('Help docs are a work in progress.');
        break;
    case 'install':
        // For readability, print a couple blank lines
        permaclog('');
        permaclog('');
        var clean = (command.args.clean == 'clean');
        if(clean === true) {
            permaclog('-- RUNNING AS CLEAN INSTALL --');
            permaclog('');
            permaclog('');
            permaclog('');
        }
        util.install(command.args.source, command.args.installationDirectory, clean, null, function() {
            // post-installation callback method
            util.reset();
        });
        break;
    case 'update':
        clog(command.args);
        if(command.args[0] == 'clean' || command.args[1] == 'clean') {
            permaclog('-- RUNNING AS CLEAN UPDATE --');
        } else if(command.args[0]) {
            // Treat first argument as new branch/tag/hash to check out

            if(command.args[0][0] != '#') {
                command.args[0] = '#'+command.args[0];
            }

            if(!fs.existsSync('./mumi.json')) {
                permaclog('Unable to update. Could not find instructions file: '+process.cwd()+'/mumi.json');
                process.exit(1);
            }

            var mumi = JSON.parse(fs.readFileSync('./mumi.json'));
            if(!lib.isObject(mumi)) {
                permaclog('Unable to update. mumi.json contents are not a valid JSON object.');
                process.exit(1);
            }

            var sourceType = '';
            try {
                var stats = fs.statSync(mumi.source);
                if(stats.isDirectory()) {
                    sourceType = 'directory';
                } else if(stats.isFile()) {
                    sourceType = 'file';
                } else if(stats.isSymbolicLink()) {
                    sourceType = 'symlink';
                }
            } catch(e) {
                sourceType = 'repository';
            }

            // Modify the hash on the repository URL if the source is a repository URL
            if(sourceType == 'repository') {
                var repositoryUrlParts = URL.parse(mumi.source);
                mumi.source = repositoryUrlParts.path+command.args[0];
                clog(repositoryUrlParts);
                clog('new source: '+mumi.source);
                fs.writeFileSync('./mumi.json', JSON.stringify(mumi, null, "\t"));
            } else {
                permaclog('Unable to switch commit-ish. mumi.json source is not a repository URL.');
                process.exit(1);
            }
        }
        util.update(clean);
        break;
    case 'debug':
        util.runDebugOperations();
        break;
}
