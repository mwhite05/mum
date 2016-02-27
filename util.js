'use strict';
const fs = require('fs');
const mkdirp = require('mkdirp');
const lib = require('./lib.js');
//const handlebars = require('handlebars');
const path = require('path');
const extend = require('extend');
const child_process = require('child_process');
const readlineSync = require('readline-sync');
//const cla = require('command-line-args');
const clog = lib.clog;

/* RULES:
        * Any variable named *Directory is a path to a directory.
        * Directory paths do _not_ end in a trailing slash.
        * Any variable named *File is a path to a file.
        * Any variable named *Url is a URL to a resource.
        * Relative directory and file paths are expanded at the earliest possible moment.
*/

module.exports = {
    _defaultMumConfig: {
        name: null,
        install: {
            map: [
                {
                    source: './',
                    destination: './'
                }
            ],
            scripts: {
                before: [],
                after: []
            }
        },
        update: {
            scripts: {
                before: [],
                after: []
            }
        },
        dependencies: []
    },
    _defaultMumDependency: {
        name: null,
        url: null,
        version: null,
        installTo: null
    },
    /**
    * A commit-ish can be any of: sha-1 hash for a specific commit, branch name, tag name.
    * If the commit-ish portion of the URL is blank or left of entirely, the default is master.
    *
    */
    _getCommitIsh: function(repositoryUrl) {
        var parts = URL.parse(repositoryUrl);
        var commitIsh = parts.hash.replace('#', ''); // get the commit-ish (npm term) from the end of the url
        return commitIsh ? commitIsh : 'master';
    },
    _prepareInstallationDirectory: function(installationDirectory, clean) {
        var installationMode = 'overwrite';
        if(fs.existsSync(installationDirectory)) { // If installation directory exists
            if(clean && ! lib.isDirectoryEmpty(installationDirectory)) { // If not empty
                clog('The installation directory '+installationDirectory+' is not empty. Mum cannot guarantee a clean and safe installation unless the directory is empty.');
                switch(readlineSync.keyInSelect(['Wipe (delete all existing contents)', 'Overwrite (leave existing contents in place)'], 'Choose an option:')) { // Then ask user if they want to wipe the directory _______
                    case 0:
                        installationMode = 'wipe';
                        clog('Installation will delete the contents of: '+installationDirectory);
                    break;
                    case 1:
                        installationMode = 'overwrite';
                        clog('Installation will overwrite the non-empty directory: '+installationDirectory);
                    break;
                    case -1:
                    default:
                        clog('Cancelling installation.');
                        process.exit();
                }
            }

            if(readlineSync.keyInYN('Are you sure you want to '+installationMode+' and install to: '+installationDirectory+'?')) { // Ask the user if they are sure they want to install to __________
                clog('Continuing with installation.');
                if(installationMode == 'wipe') {
                    clog('Deleting all contents of: '+installationDirectory);
                    lib.wipeDirectory(installationDirectory);
                }
                return;
            } else {
                clog('Cancelling installation.');
                process.exit(1);
            }
        } else {
            if(readlineSync.keyInYN('Are you sure you want to install to: '+installationDirectory+'?')) { // Ask the user if they are sure they want to install to __________
                clog('Attempting to create the installation directory: '+installationDirectory);
                // Ensure directory is created (recursive)
                mkdirp.sync(installationDirectory);
                if(! fs.existsSync(installationDirectory)) { // If directory fails to create
                    clog('Failed to created the installation directory: '+installationDirectory);
                    process.exit(1); // Then exit program
                }
            } else {
                clog('Cancelling installation. Directory creation skipped so installation directory does not exist.');
                process.exit(1); // Exit program
            }
        }
    },
    _readMumJson(file) {
        if(! fs.existsSync(file)) {
            return this._defaultMumConfig;
        }

        var mumc = JSON.parse(fs.readFileSync(file));
        if(! lib.isObject(mumc)) {
            return this._defaultMumConfig;
        }

        mumc = extend(this._defaultMumConfig, mumc);

        return mumc;
    },
    _validateSourceDirectory: function(directory) {
        if(! fs.existsSync(directory)) {
            clog('The source directory could not be found: '+directory);
            process.exit(1);
        }
    },
    _resolve(a, b) {
        if(b[0] == '/') {
            // b is an absolute path so we do not add a as a prefix
            return path.resolve(b);
        } else {
            return path.resolve(a+'/'+b);
        }
    },
    installFromDirectory: function(sourceDirectory, installationDirectory, clean) {
        var self = this;

        clean = typeof(clean) == 'undefined' ? false : true;
        sourceDirectory = path.resolve(sourceDirectory);
        installationDirectory = path.resolve(installationDirectory);
        this._validateSourceDirectory(sourceDirectory);
        this._prepareInstallationDirectory(installationDirectory, clean);

        var mumc = this._readMumJson(sourceDirectory+'/mum.json');

        // Perform all configuration verification steps necessary
        if(! lib.isArray(mumc.install.map)) {
            clog('Invalid mum.json configuration : The install.map property must be an array<object>{source:<string>, destination:<string>}.');
            process.exit(1);
        }

        if(! lib.isObject(mumc.install.scripts)) {
            clog('Invalid mum.json configuration : The install.scripts property must be an <object>{before:<array><string>, after:<array><string>}.');
            process.exit(1);
        }

        if(! lib.isArray(mumc.install.scripts.before)) {
            clog('Invalid mum.json configuration : The install.scripts.before property must be an array<string>.');
            process.exit(1);
        }

        if(! lib.isArray(mumc.install.scripts.after)) {
            clog('Invalid mum.json configuration : The install.scripts.after property must be an array<string>.');
            process.exit(1);
        }

        // run before install scripts
        mumc.install.scripts.before.forEach(function(scriptFile, index) {
            var scriptFile = self._resolve(sourceDirectory, scriptFile);
            clog(child_process.execSync('"'+scriptFile+'" -d "'+installationDirectory+'"').toString());
        });

        // loop over each item in the installMap
        mumc.install.map.forEach(function(value, index) {
            // resolve the path for source
            var source = self._resolve(sourceDirectory, value.source);
            // resolve the path for destination
            var destination = self._resolve(installationDirectory, value.destination);

            // Verify source
            self._validateSourceDirectory(source);

            // Create destination if required
            if(! fs.existsSync(destination)) {
                mkdirp.sync(destination);
            }

            // sync source to destination
            lib.overlayFilesRecursive(source, destination);
        });

        // run after install scripts
        mumc.install.scripts.after.forEach(function(scriptFile, index) {
            var scriptFile = self._resolve(sourceDirectory, scriptFile);
            clog(child_process.execSync('"'+scriptFile+'" -d "'+installationDirectory+'"').toString());
        });

        clog('Installation complete.');
    },
    installFromTarball: function(tarballFile, installationDirectory) {
        this._prepareInstallationDirectory();

        // TODO This should be easy enough - Unpack the tarball to .mum/.local/<nameOfTarball> then call this.installFromDirectory() using the local unpacked tarball as the source directory.
    },
    installFromRepository: function(repositoryUrl, installationDirectory) {
        this._prepareInstallationDirectory();

        // Handles version scenarios like >, <, >=, <=, =
        // Syntax is part of commit-ish like: #>=2.0.0
        // Will use node-semver to figure this out - probably will have to clone the repo first and get lists of all tags and branches to use for comparison in a loop

        /*
            If github url then
                create https version of the url
                look up a list of the tags and heads using git ls-remote --tags --heads <url>
            Else
                try to use git ls-remote with the URL we were given
            End

            If we have a valid list of tags and heads (branches)
                Get target ref with any version modifiers (>, <, >=, <=) applied (tag/branch)
                If no target ref found matching the supplied commit-ish then we were probably given a bad version OR a commit sha-1 hash
                    Try cloning the target as if it were a commit sha-1 hash
                    If error
                        Print a message about being unable to clone the repository for the supplied commit-ish.
                        Exit
                    End
                Else
                    Try cloning the target as if it were a tag or branch (these are interchangeable)
                    If error
                        Print a message about being unable to clone the repository for the supplied sha-1 hash.
                        Exit
                    End
                End
            Else
                Try cloning the target URL _without_ specifying a commit sha-1, tag, or branch
                If error
                    Print a message about being unable to clone the repository
                    Exit
                End

                Get a list of branches and tags from the local clone of the repository
                Get target ref with any version modifiers (>, <, >=, <=) applied (tag/branch)

                If no target ref found matching the supplied commit-ish then we were probably given a bad version OR a commit sha-1 hash
                    Try checking out the target as if it were a commit sha-1 hash
                    If error
                        Print a message about being unable to clone the repository for the supplied commit-ish.
                        Exit
                    End
                Else
                    Try checking out the target as if it were a tag or branch (these are interchangeable)
                    If error
                        Print a message about being unable to clone the repository for the supplied sha-1 hash.
                        Exit
                    End
                End
            End

            Install from directory
        */

    }
};
