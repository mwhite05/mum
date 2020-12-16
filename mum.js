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

const mainOptions = commandLineArgs([
    {
        name: 'command',
        defaultOption: true,
        defaultValue: 'help'
    },
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        defaultValue: false
    },
    {
        name: 'version',
        alias: 'v',
        type: Boolean,
        defaultValue: false
    }
], {stopAtFirstUnknown: true});

// Check if they are asking for version info. If so, only give them that.
if(mainOptions.version === true) {
    permaclog("mum "+props.packageConfig.version+"\n\nCopyright (c) 2016-2019 Michael White");
    util.exit(0);
}

// Manipulate the options to make it think the help command was used (centralizes our help handling to a single case statement)
if(mainOptions.help === true) {
    mainOptions._unknown = [mainOptions.command];
    mainOptions.command = 'help';
}

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
                type: Boolean,
                defaultValue: false
            },
            {
                name: 'quiet',
                alias: 'q',
                type: Boolean,
                defaultValue: false
            },
            {
                name: 'yes',
                alias: 'y',
                type: Boolean,
                defaultValue: false
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
    case 'update':
        const updateOptions = commandLineArgs([
            {
                name: 'version',
                alias: 'v',
                defaultOption: true,
                defaultValue: '',
                type: String
            },
            {
                name: 'disableSync',
                alias: 'S',
                type: Boolean,
                defaultValue: false
            },
            {
                name: 'clean',
                alias: 'c',
                type: Boolean,
                defaultValue: false
            },
            {
                name: 'quiet',
                alias: 'q',
                type: Boolean,
                defaultValue: false
            },
            {
                name: 'yes',
                alias: 'y',
                type: Boolean,
                defaultValue: false
            }
        ], {stopAtFirstUnknown: true, argv: mainOptions._unknown || []});

        if(updateOptions.yes === true) {
            util.confirmInstallation();
        }
        if(updateOptions.quiet === true) {
            util.silenceTheBell();
        }
        if(updateOptions.disableSync === true) {
            util.disableSync = true;
            lib.disableSync = true;
        }
        if(updateOptions.version) {
            if(updateOptions.version[0] !== '#') {
                updateOptions.version = '#' + updateOptions.version;
            }
            util.updateMumiJson(updateOptions.version);
        }
        util.update(updateOptions.clean);
        break;
    case 'debug':
        lib.test();
        //util.runDebugOperations();
        break;
    case 'help':
    default:
        const helpOptions = commandLineArgs([
            {
                name: 'system',
                defaultOption: true,
                defaultValue: '',
                type: String
            }
        ], {stopAtFirstUnknown: true, argv: mainOptions._unknown || []});
        switch(helpOptions.system) {
            case 'install':
            case 'update':
            case 'config':
            case 'debug':
                util.printHelp(helpOptions.system);
                break;
            case '':
            default:
                util.printHelp('help');
                break;
        }
        break;
}
