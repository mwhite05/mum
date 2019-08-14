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
const commandLineArgs = require('command-line-args');

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

const mainOptions = commandLineArgs([
    {
        name: 'command',
        defaultOption: true
    }
], {stopAtFirstUnknown: true});

// Now parse the options of each individual command
switch (mainOptions.command) {
    case 'install':
        const installOptions = commandLineArgs([
            {
                name: 'sourceAndTarget',
                multiple: true,
                defaultOption: true,
                type: String
            },
            {
                name: 'clean',
                alias: 'c',
                type: Boolean
            },
            {
                name: 'quiet',
                alias: 'q',
                type: Boolean
            },
            {
                name: 'yes',
                alias: 'y',
                type: Boolean
            }
        ], {stopAtFirstUnknown: true, argv: mainOptions._unknown || []});
        if(installOptions.sourceAndTarget.length < 2) {
            permaclog("\nYou must specify both the source and target arguments:\nUsage:\n mum install <source> <target> [-ycq]\nFor more details, run:\nmum -h install");
            util.exit(1);
        }
        if(installOptions.yes === true) {
            util.confirmInstallation();
        }
        if(installOptions.quiet === true) {
            util.silenceTheBell();
        }
        util.install(installOptions.sourceAndTarget[0], installOptions.sourceAndTarget[1], installOptions.clean, null, function() {
            // post-installation callback method
            util.reset();
            util.notifySuccess();
        });
        //clog("\n\nInstall Options\n", installOptions);
        break;


    case 'old-update':
        clog(command.args);
        if(command.args[0] == 'clean' || command.args[1] == 'clean') {
            permaclog('-- RUNNING AS CLEAN UPDATE --');
        } else if(command.args[0]) {
            var updateMumiJson = false;
            if(command.args[0] === 'ds' || command.args[0] === 'disableSync') {
                util.disableSync = true;
                lib.disableSync = true;
            } else if(command.args[0][0] != '#') {
                command.args[0] = '#' + command.args[0];
                updateMumiJson = true;
            }

            if(!fs.existsSync('./mumi.json')) {
                permaclog('Unable to update. Could not find instructions file: '+process.cwd()+'/mumi.json');
                util.exit(1);
            }

            var mumi = JSON.parse(fs.readFileSync('./mumi.json'));
            if(!lib.isObject(mumi)) {
                permaclog('Unable to update. mumi.json contents are not a valid JSON object.');
                util.exit(1);
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
            if(updateMumiJson === true) {
                if(sourceType == 'repository') {
                    var repositoryUrlParts = URL.parse(mumi.source);
                    mumi.source = repositoryUrlParts.path + command.args[0];
                    clog(repositoryUrlParts);
                    clog('new source: ' + mumi.source);
                    fs.writeFileSync('./mumi.json', JSON.stringify(mumi, null, "\t"));
                } else {
                    permaclog('Unable to switch commit-ish. mumi.json source is not a repository URL.');
                    util.exit(1);
                }
            }
        }
        util.update(clean);
        break;
    case 'old-debug':
        util.runDebugOperations();
        break;
    case 'old-help':
        // todo - write complete help docs
        permaclog('Usage examples: ');
        permaclog('');
        permaclog('# mum install <folder> <installTargetFolder>');
        permaclog('# mum install <zipFile> <installTargetFolder>');
        permaclog('# mum install <repoUrl#branch|tag|hash> <installTargetFolder>');
        permaclog('# mum update <branch|tag|hash>');
        permaclog('# mum update');
        permaclog('# mum update disableSync');
        permaclog('# mum update ds');
        break;
    case 'old-install':
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
            util.notifySuccess();
        });
        break;
}
