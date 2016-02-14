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
const clog = lib.clog;

var packageConfigFilePath = __dirname+'/package.json';
var packageConfig;
// Get version number from package.json
try {
    packageConfig = JSON.parse(fs.readFileSync(packageConfigFilePath));
} catch(e) {
    clog('Your Modern Update Manager (mum) installation is corrupt.\nUnable to initialize your preferences file because we cannot read the '+packageConfigFilePath+' file.\nThat file should be part of the mum-x.y.z.tgz package file you downloaded.');
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

mkdirp.sync(props.appTmpPath); // initialize Evolve application data and tmp directories.
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
            name: 'url'
            // other things will be added here like:
            // validate: function() {}
            // format: function() {} (or clean or set)
        },
        {
            // The base install path for the target repository
            name: 'dir',
            default: '.'
        }
    ]
};

// Parse the command line arguments/commands
var command = lib.readCommandInput(commands);

switch (command.name) {
    case 'help':
        // todo - write complete help docs
        clog('Help docs in progress.');
        break;
    case 'install':
        install(command.args.url, command.args.dir);
        break;
    case 'update':
        clog('updater');
        break;
}

function install(url, dir) {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    var parts = URL.parse(url);

    var version = parts.hash.replace('#', ''); // get the commit-ish (npm term) from the end of the url
    url = parts.path;

    if(dir == '/') {
        clog('Safety mode engaged. You cannot install to the root directory: '+dir);
        process.exit(1);
    }

    var paths;
    if(fs.existsSync(dir)) {
        paths = fs.readdirSync(dir);
        if(paths.length > 2) { // length of array is always 2 or more [../, ./] (except for root directory which we handle separately above ^^^)
            clog('Safety mode engaged. You cannot install to the non-empty directory: '+dir);
            process.exit(1);
        }

        // The directory exists but is empty - we're okay to install to it
    } else if(! mkdirp.sync(dir)) {
        clog('Could not find or create the target installation directory: '+dir);
        process.exit(1);
    }

    dir = fs.realpathSync(dir);

    var projectName = path.parse(path.basename(url)).name;
    //dir = (dir + '/' + projectName).replace(/\/{2,}/, '/');

    var srcDir = dir + '/../.mum';

    rl.question('Install '+projectName+'@'+version+' to '+dir+"? [Y/n]\n", function(input) {

        switch(input.toLowerCase()) {
            case 'y':
            case 'yes':
                _install({
                    name: projectName,
                    version: version,
                    url: url,
                    src: srcDir,
                    dir: dir
                });
                break;
            default:
                clog('Canceling installation.');
                rl.close();
                process.exit(1);
                break;
        }

        rl.close();

    });
}

function _install(r) {
    _cloneRepository(r, 'install');

}

function _cloneRepository(r, mode) {
    var overlayList = [];

    clog('raw r.dir: ' + r.dir);

    var srcDir = r.src+'/../.mum/'+ r.name;

    if(fs.existsSync(srcDir)) {
        // Wipe it clean for installs
        if(mode == 'install') {
            clog('todo - wipe the directory: '+srcDir);
        }
    } else if(! mkdirp.sync(srcDir)) {
        clog('Could not find or create the target installation src directory: '+srcDir);
        process.exit(1);
    }

    srcDir = fs.realpathSync(srcDir);

    var destinationDir = r.dir;

    // Is this a relative path?
    if(destinationDir[0] != '/') {
        // Relative path detected, prefix it
        destinationDir = (r.src + '/' + r.dir).replace(/\/{2,}/, '/');
    }

    overlayList.push({
        source: srcDir, // The location of the local copy of the git repository
        destination: destinationDir // The location of the files after they are installed (copied from the git repo to their target)
    });

    // If the branch or tag is not present then it will return a fatal error and disconnect
    var $cmd = 'git clone --branch ' + r.version + ' "' + r.url + '" "' + srcDir + '"';

    clog($cmd);

    try {
        child_process.execSync($cmd);
    } catch(e) {
        process.exit(1);
    }

    // All done with cloning this repository - gather dependency information

    // get dependencies from mum.json in repository root
    // todo cyclic dependency protection
    var dependencies = [];
    if(fs.existsSync(srcDir+'/mum.json')) {
        var mumInfo = JSON.parse(fs.readFileSync(srcDir + '/mum.json'));
        if(lib.isArray(mumInfo.dependencies)) {
            dependencies = mumInfo.dependencies;
        }
    }

    dependencies.forEach(function(dep) {
        var projectName = '';
        if(lib.isDefined(dep.name)) {
            projectName = dep.name;
        }

        if(!projectName) {
            projectName = path.parse(path.basename(dep.url)).name;
        }

        var depDir = dep.dir;

        // Is this a relative path?
        if(depDir[0] != '/') {
            // Relative path detected, prefix it
            depDir = (r.dir + '/' + dep.dir).replace(/\/{2,}/, '/');
        }

        var o = {
            name: projectName,
            url: dep.url,
            version: dep.version,
            src: r.src, // pass this down for all levels of depth - we store repositories for all levels at the same flat level
            dir: depDir
        };
        clog('dep is: ', o);
        _cloneRepository(o);
    });

    overlayList.reverse(); // Go backwards - the custom thing we are installing may have overrides for things defined in the dependencies
    overlayList.forEach(function(overlaySet) {
        lib.overlayFilesRecursive(overlaySet.source, overlaySet.destination);
    });
}


function update() {
    // NOTE: git tag -l <pattern> and git branch - l <pattern> will be very useful
    // So will git clone --branch <name> (<name> can be a tag too)
}

// node mum install git@bitbucket.org:michaelwhite/php7.git#0.1.x ./test
// node mum git@bitbucket.org:michaelwhite/php7.git#0.1.x
