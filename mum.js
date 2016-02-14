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
    ],
    update: []
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
        update();
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
    var o = _cloneRepository(r, 'install');

    // Save a configuration file containing information about this installation required to run updates later.
    var installConfigFile = path.dirname(path.dirname(o.src))+'/mumi.json'; // mum installation file
    if(fs.existsSync(installConfigFile)) {
        fs.unlinkSync(installConfigFile);
    }

    var installInfo = {
        name: r.name,
        version: r.version,
        url: r.url,
        sources: path.dirname(o.src),
        destination: fs.realpathSync(r.dir)
    };

    fs.writeFileSync(installConfigFile, JSON.stringify(installInfo));
}

function _cloneRepository(r, mode) {
    var overlayList = [];

    var srcDir = r.src+'/../.mum/'+ r.name;

    if((mode == 'install' || mode == 'update') && fs.existsSync(srcDir)) {
        lib.wipeDirectory(fs.realpathSync(path.dirname(srcDir)));
    }

    if(! fs.existsSync(srcDir)) {
        if(! mkdirp.sync(srcDir)) {
            clog('Could not find or create the target installation src directory: ' + srcDir);
            process.exit(1);
        }
    } else if(mode.substring(0, 11) == 'dependency-') {
        // Looks like we already have this software package cloned, skip
        return;
    }

    srcDir = fs.realpathSync(srcDir);

    var destinationDir = r.dir;

    // Is this a relative path?
    if(destinationDir[0] != '/') {
        // Relative path detected, prefix it
        destinationDir = (r.src + '/' + r.dir).replace(/\/{2,}/, '/');
    }

    if(mode == 'install') {
        lib.wipeDirectory(destinationDir);
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
        _cloneRepository(o, 'dependency-'+mode);
    });

    overlayList.reverse(); // Go backwards - the custom thing we are installing may have overrides for things defined in the dependencies
    overlayList.forEach(function(overlaySet) {
        lib.overlayFilesRecursive(overlaySet.source, overlaySet.destination);
    });

    return {
        src: srcDir
    };
}

function update() {
    // todo - try to work out a way to use git fetch, git pull, and git checkout that will satisfy deterministic dependency resolution and be more efficient than re-cloning the entire repository.
    // NOTE: git tag -l <pattern> and git branch - l <pattern> may be very useful in this ^^^
    // So might git clone --branch <name> (<name> can be a tag too) ^^^

    // For now, just clone the repository again as if using an install but don't wipe the destination install directory
    // Obtain the information provided in the original install command by reading the mumi.json file in the current directory

    // If there is no mumi.json file we cannot continue with an update.
    if(!fs.existsSync('./mumi.json')) {
        lib.clog('Unable to update. Could not find instructions file: '+process.cwd()+'/mumi.json');
        process.exit(1);
    }

    var mumi = JSON.parse(fs.readFileSync('./mumi.json'));
    if(!lib.isObject(mumi)) {
        lib.clog('Unable to update. mumi.json contents are not an object.');
        process.exit(1);
    }

    _cloneRepository({
        name: mumi.name,
        version: mumi.version,
        url: mumi.url,
        src: mumi.sources,
        dir: mumi.destination
    }, 'update');
}

function _updateRepository(repoPath) {

}
