'use strict';
const fs = require('fs');
//noinspection SpellCheckingInspection
const unzipper = require('unzipper');
//const zlib = require('zlib');
const tar = require('tar');
const sha1 = require('sha1');
const URL = require('url');
const mkdirp = require('mkdirp');
const lib = require('./lib.js');
const path = require('path');
const extend = require('extend');
const child_process = require('child_process');
const readlineSync = require('readline-sync');
//const cla = require('command-line-args');
const clog = lib.clog;
//noinspection SpellCheckingInspection
const permaclog = lib.clog;

/* RULES:
        * Any variable named *Directory is a path to a directory.
        * Directory paths do _not_ end in a trailing slash.
        * Any variable named *File is a path to a file.
        * Any variable named *Url is a URL to a resource.
        * Relative directory and file paths are expanded at the earliest possible moment.
*/

module.exports = {
    _mumi: null,
    _disableSourceUpdates: false,
    _installationConfirmed: false,
    _bellEnabled: true,
    _baseLevelInstallationDirectory: null,
    _defaultMumConfig: {
        name: null,
        install: {
            map: [
                {
                    source: './',
                    target: './',
                }
            ],
            scripts: {
                beforeInstall: [],
                beforeSync: [],
                afterSync: [],
                afterInstall: [],
                cleanup: []
            },
            excludes: []
        },
        update: {
            scripts: {
                beforeInstall: [],
                beforeSync: [],
                afterSync: [],
                afterInstall: [],
                cleanup: []
            }
        },
        dependencies: []
    },
    _defaultMumDependency: {
        name: null,
        source: null,
        target: null,
        config: {}
    },
    disableSync: false,
    /**
    * A commit-ish can be any of: sha-1 hash for a specific commit, branch name, tag name.
    * If the commit-ish portion of the URL is blank or left of entirely, the default is master.
    *
    */
    _cloneRepository: function(repositoryUrl, cloneTargetDirectory) {
        if(this.disableSync === true) {
            permaclog('Skipping clone of repository: '+repositoryUrl+ ' to: '+cloneTargetDirectory);
            return true;
        }
        lib.wipeDirectory(cloneTargetDirectory);

        // If the branch or tag is not present then it will return a fatal error and disconnect
        var cmd = 'git clone "' + repositoryUrl + '" "' + cloneTargetDirectory + '"';

        permaclog(cmd);

        try {
            child_process.execSync(cmd);
        } catch(e) {
            return false;
        }

        return true;
    },
    _checkOutCommitIsh: function(repositoryPath, commitIsh) {
        if(this.disableSync === true) {
            permaclog('Skipping checkout of commitIsh: '+commitIsh+ ' on: '+repositoryPath);
            return true;
        }
        // If the hash, branch or tag is not present then it will return a fatal error and disconnect
        var cmd = 'git checkout "' + commitIsh+'"';

        permaclog(cmd);

        try {
            var cwd = process.cwd();
            // Change directories to the target directory (which should be home to a git repository)
            process.chdir(repositoryPath);
            // Run the checkout command
            child_process.execSync(cmd);
            // Change directories back to the original working directory
            process.chdir(cwd);
        } catch(e) {
            permaclog('The hash, branch, or tag provided could not be found.');
            permaclog('Repository Path: '+repositoryPath);
            permaclog('Commit-ish: '+commitIsh);
            this.exit(1);
        }

        return true;
    },
    _updateLocalRepository: function(repositoryPath, commitIsh) {
        if(this.disableSync === true) {
            permaclog('Skipping local repository update for commitIsh: '+commitIsh+ ' on: '+repositoryPath);
            return true;
        }
        // If the hash, branch or tag is not present then it will return a fatal error and disconnect
        var cmds = [];
        cmds.push('rm -rf *'); // Removing all files works better than just a hard reset
        cmds.push('git reset --hard');
        cmds.push('git fetch');
        cmds.push('git checkout "' + commitIsh+'"');
        cmds.push('git pull');

        try {
            var cwd = process.cwd();
            // Change directories to the target directory (which should be home to a git repository)
            process.chdir(repositoryPath);
            // Run the commands
            cmds.forEach(function(cmd, index) {
                permaclog(cmd);
                child_process.execSync(cmd);
            });
            // Change directories back to the original working directory
            process.chdir(cwd);
        } catch(e) {
            return false;
        }

        return true;
    },
    _getCommitIsh: function(repositoryUrl) {
        var parts = URL.parse(repositoryUrl);
        var commitIsh = parts.hash.replace('#', ''); // get the commit-ish (npm term) from the end of the url
        return commitIsh ? commitIsh : 'master';
    },
    confirmInstallation: function() {
        this._installationConfirmed = true;
    },
    silenceTheBell: function() {
        this._bellEnabled = false;
    },
    _prepareInstallationDirectory: function(installationDirectory, clean) {
        if(this.disableSync === true) {
            clean = false;
        }
        var installationMode = 'overwrite';
        var installAllowed = this._installationConfirmed;
        if(fs.existsSync(installationDirectory)) { // If installation directory exists
            if(clean && ! lib.isDirectoryEmpty(installationDirectory)) { // If not empty
                installationMode = 'wipe';
                /*clog('The installation directory '+installationDirectory+' is not empty. Mum cannot guarantee a clean and safe installation unless the directory is empty.');
                switch(readlineSync.keyInSelect(['Wipe (delete all existing contents)', 'Overwrite (leave existing contents in place)'], 'Choose an option:')) { // Then ask user if they want to wipe the directory _______
                    case 0:
                        installationMode = 'wipe';
                        permaclog('Installation will delete the contents of: '+installationDirectory);
                    break;
                    case 1:
                        installationMode = 'overwrite';
                        permaclog('Installation will overwrite the non-empty directory: '+installationDirectory);
                    break;
                    case -1:
                    default:
                        permaclog('Cancelling installation.');
                        this.exit();
                }*/
            }

            if(!installAllowed) {
                this.notifyAwaitingInput();
                installAllowed = readlineSync.keyInYN('Are you sure you want to install to: '+installationDirectory+'?');
            }

            if(installAllowed) {
                this._installationConfirmed = true;
                // Ensure directory is created (recursive)
                if(installationMode === 'wipe') {
                    permaclog('Attempting to wipe the installation directory: '+path.resolve(installationDirectory));
                    lib.wipeDirectory(installationDirectory);
                    if(! lib.isDirectoryEmpty(installationDirectory)) { // If directory is still not empty
                        permaclog('Directory is not empty. Failed to wipe the installation directory: '+installationDirectory);
                        this.exit(1); // Then exit program
                    }
                }
            } else {
                permaclog('Cancelling installation.');
                this.exit(1);
            }

            /*if(readlineSync.keyInYN('Are you sure you want to '+installationMode+' and install to: '+installationDirectory+'?')) { // Ask the user if they are sure they want to install to __________
                permaclog('Continuing with installation.');
                if(installationMode == 'wipe') {
                    permaclog('Deleting all contents of: '+installationDirectory);
                    lib.wipeDirectory(installationDirectory);
                }
                return;
            } else {
                permaclog('Cancelling installation.');
                this.exit(1);
            }*/
        } else {
            if(!installAllowed) {
                this.notifyAwaitingInput();
                installAllowed = readlineSync.keyInYN('Are you sure you want to install to: '+installationDirectory+'?');
            }

            if(installAllowed) {
                this._installationConfirmed = true;
                permaclog('Attempting to create the installation directory: '+installationDirectory);
                // Ensure directory is created (recursive)
                mkdirp.sync(installationDirectory);
                if(! fs.existsSync(installationDirectory)) { // If directory fails to create
                    permaclog('Failed to created the installation directory: '+installationDirectory);
                    this.exit(1); // Then exit program
                }
            } else {
                permaclog('Cancelling installation. Directory creation skipped so installation directory does not exist.');
                this.exit(1); // Exit program
            }
        }
    },
    _readMumJson: function(file) {
        if(! fs.existsSync(file)) {
            return extend({}, this._defaultMumConfig);
        }

        var mumc = JSON.parse(fs.readFileSync(file));
        if(! lib.isObject(mumc)) {
            return extend({}, this._defaultMumConfig);
        }

        mumc = extend({}, this._defaultMumConfig, mumc);

        return mumc;
    },
    getMumiData: function() {
        if(this._mumi) {
            return this._mumi;
        }
        if(!fs.existsSync('./mumi.json')) {
            permaclog('Unable to update. Could not find instructions file: '+process.cwd()+'/mumi.json');
            this.exit(1);
        }

        this._mumi = JSON.parse(fs.readFileSync('./mumi.json'));
        if(!lib.isObject(this._mumi)) {
            permaclog('Unable to update. mumi.json contents are not a valid JSON object.');
            this.exit(1);
        }
        this._mumi = this._legacySupport_convert_installTo_into_target(this._mumi);
        return this._mumi;
    },
    updateMumiJson: function(newVersion) {
        var mumi = this.getMumiData();

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
        if(sourceType === 'repository') {
            var repositoryUrlParts = URL.parse(mumi.source);
            mumi.source = repositoryUrlParts.path + newVersion;
            fs.writeFileSync('./mumi.json', JSON.stringify(mumi, null, "\t"));
        } else {
            permaclog('Unable to switch commit-ish. mumi.json source is not a repository URL.');
            this.exit(1);
        }
    },
    _validateSourceDirectory: function(directory) {
        if(! fs.existsSync(directory)) {
            permaclog('The source directory could not be found: '+directory);
            this.exit(1);
        }
    },
    _resolve: function(a, b) {
        if(b[0] == '/' || b[0] == '\\') {
            // b is an absolute path so we do not add a as a prefix
            return path.resolve(b);
        } else {
            a = a.replace(/\\\//g, ''); // trim off trailing slashes
            return path.resolve(a+'/'+b);
        }
    },
    _getMumCacheDirectory: function() {
        var mumDirectory = this._resolve(this._baseLevelInstallationDirectory, '../.mum');
        if(!fs.existsSync(mumDirectory)) {
            mkdirp.sync(mumDirectory);
        }
        return mumDirectory;
    },
    _legacySupport_convert_installTo_into_target: function(obj) {
        if(obj.installTo) {
            obj.target = obj.installTo;
        }
        return obj;
    },
    installFromDirectory: function(sourceDirectory, installationDirectory, clean, o, callback, meta) {
        var self = this;
        var baseLevel = false;
        if(!(o instanceof Object)) {
            baseLevel = true;
            // o is essentially a flattened list of all mum.json configurations from the primary and dependent installation sources
            o = {
                beforeInstall: [],
                beforeSync: [],
                afterSync: [],
                afterInstall: [],
                cleanup: [],
                maps: []
            };
        }

        //baseProject = (typeof(baseProject) == 'undefined') ? false : baseProject;
        clean = (typeof(clean) == 'undefined') ? false : clean;
        sourceDirectory = path.resolve(sourceDirectory);
        installationDirectory = path.resolve(installationDirectory);
        this._validateSourceDirectory(sourceDirectory);
        this._prepareInstallationDirectory(installationDirectory, clean);

        if(!process.env.MUM_CURRENT_INSTALL_DIR) {
            process.env.MUM_INITIAL_INSTALL_DIR = installationDirectory;
        }
        process.env.MUM_CURRENT_SOURCE_DIR = sourceDirectory;
        process.env.MUM_CURRENT_INSTALL_DIR = installationDirectory;

        var mumc = this._readMumJson(sourceDirectory+'/mum.json');

        // Perform all configuration verification steps necessary
        if(typeof(mumc.install.map) == 'undefined') {
            // Use the default map if none was defined in the configuration.
            mumc.install.map = this._defaultMumConfig.install.map;
        }

        if(! lib.isArray(mumc.install.map)) {
            permaclog('Invalid mum.json configuration : The install.map property must be an array<object>{source:<string>, destination:<string>}.');
            this.exit(1);
        }

        if(! lib.isObject(mumc.install.scripts)) {
            permaclog('Invalid mum.json configuration : The install.scripts property must be an <object>{beforeInstall:<array><string>, beforeSync:<array><string> afterSync:<array><string>, afterInstall:<array><string>, cleanup:<array><string>}.');
            this.exit(1);
        }

        if(typeof(mumc.install.scripts.beforeInstall) == 'undefined') {
            mumc.install.scripts.beforeInstall = [];
        }

        if(typeof(mumc.install.scripts.beforeSync) == 'undefined') {
            mumc.install.scripts.beforeSync = [];
        }

        if(typeof(mumc.install.scripts.afterSync) == 'undefined') {
            mumc.install.scripts.afterSync = [];
        }

        if(typeof(mumc.install.scripts.afterInstall) == 'undefined') {
            mumc.install.scripts.afterInstall = [];
        }

        if(typeof(mumc.install.scripts.cleanup) == 'undefined') {
            mumc.install.scripts.cleanup = [];
        }

        if(! lib.isArray(mumc.install.scripts.beforeInstall)) {
            permaclog('Invalid mum.json configuration : The install.scripts.beforeInstall property must be an array<string>.');
            this.exit(1);
        }

        if(! lib.isArray(mumc.install.scripts.beforeSync)) {
            permaclog('Invalid mum.json configuration : The install.scripts.beforeSync property must be an array<string>.');
            this.exit(1);
        }

        if(! lib.isArray(mumc.install.scripts.afterSync)) {
            permaclog('Invalid mum.json configuration : The install.scripts.afterSync property must be an array<string>.');
            this.exit(1);
        }

        if(! lib.isArray(mumc.install.scripts.afterInstall)) {
            permaclog('Invalid mum.json configuration : The install.scripts.afterInstall property must be an array<string>.');
            this.exit(1);
        }

        if(! lib.isArray(mumc.install.scripts.cleanup)) {
            permaclog('Invalid mum.json configuration : The install.scripts.cleanup property must be an array<string>.');
            this.exit(1);
        }

        // Add the before install scripts to the options
        o.beforeInstall.unshift({
            directory: sourceDirectory,
            scripts: mumc.install.scripts.beforeInstall
        });

        o.beforeSync.unshift({
            directory: sourceDirectory,
            scripts: mumc.install.scripts.beforeSync
        });

        /*// run before install scripts
        var cwd = process.cwd();
        process.chdir(sourceDirectory);
        mumc.install.scripts.beforeInstall.forEach(function(scriptFile, index) {
            var scriptFile = self._resolve(sourceDirectory, scriptFile);
            // Force-set executable permissions on the target script file
            child_process.execSync('chmod u+x "'+scriptFile+'"', {stdio: 'inherit'});
            child_process.execSync('"'+scriptFile+'"', {stdio: 'inherit'});
        });
        process.chdir(cwd);*/

        if(mumc.dependencies.length) {
            mumc.dependencies.forEach(function(dependency, index) {
                var dep = extend({}, self._defaultMumDependency, dependency);
                dep = self._legacySupport_convert_installTo_into_target(dep);
                if(dep.target[0] === '.') {
                    dep.target = installationDirectory+'/'+dep.target;
                }
                if(dep.name) {
                    o.name = dep.name;
                }
                // Add returned options to an array of returned options for all dependencies
                self.install(dep.source, dep.target, false, o);
                /*// loop over the tmpO and merge with o
                tmpO.beforeInstall.forEach(function(value, index) {
                    o.beforeInstall.unshift(value);
                });

                tmpO.afterInstall.forEach(function(value, index) {
                    o.afterInstall.push(value);
                });*/
            });

            // Restore the parent project's environment variables
            if(!process.env.MUM_CURRENT_INSTALL_DIR) {
                process.env.MUM_INITIAL_INSTALL_DIR = installationDirectory;
            }
            process.env.MUM_CURRENT_SOURCE_DIR = sourceDirectory;
            process.env.MUM_CURRENT_INSTALL_DIR = installationDirectory;

            // Only worry about this if the meta data is defined.
            if(meta && meta.cacheDirectory && meta.commitIsh) {
                // It is possible this repository branch had a dependency on another branch in the same repository. If that happened then we need to be sure we have the correct files checked out now.
                this._checkOutCommitIsh(meta.cacheDirectory, meta.commitIsh);
            }
        }

        o.afterSync.push({
            directory: sourceDirectory,
            scripts: mumc.install.scripts.afterSync
        });

        o.afterInstall.push({
            directory: sourceDirectory,
            scripts: mumc.install.scripts.afterInstall
        });

        o.cleanup.push({
            directory: sourceDirectory,
            scripts: mumc.install.scripts.cleanup
        });

        // If there are no map items, use the source and installation directory as the map
        if(!mumc.install.map.length) {
            o.maps.unshift({
                source: sourceDirectory,
                target: installationDirectory,
                exclude: []
            });
        } else {
            // loop over each item in the installMap
            mumc.install.map.forEach(function(value, index) {
                value = self._legacySupport_convert_installTo_into_target(value);
                // resolve the path for source
                var source = self._resolve(sourceDirectory, value.source);
                // resolve the path for destination
                var target = self._resolve(installationDirectory, value.target);

                // Verify source
                self._validateSourceDirectory(source);

                // Create destination if required
                if(!fs.existsSync(target)) {
                    mkdirp.sync(target);
                }

                // add this source and destination to the list of locations to sync
                o.maps.push({
                    source: source,
                    target: target,
                    excludes: value.excludes
                });
            });
        }

        if(baseLevel) {
            this._runSyncProcess(o);

            if(callback instanceof Function) {
                callback();
            }
            return null;
        }

        return o;
    },
    installFromArchive: function(archiveFile, installationDirectory, clean, o, callback) {
        archiveFile = path.resolve(archiveFile);
        installationDirectory = path.resolve(installationDirectory);

        var archiveExtension = path.extname(archiveFile);

        var cacheDirectory = this._getMumCacheDirectory(installationDirectory) + '/' + path.basename(archiveFile);

        if(this._disableSourceUpdates === true && fs.existsSync(cacheDirectory)) {
            var files = fs.readdirSync(cacheDirectory);
            if(files.length > 3) { // there will always be . and .. files listed
                permaclog('SKIPPING ARCHIVE EXTRACTION - SOURCE UPDATES DISABLED');
                afterExtraction(); // jump straight to the after extraction process to skip the update
                return;
            }
        }

        var self = this;

        function handleExtractionError(error) {
            permaclog(error);
            permaclog('Could not extract the archive: '+archiveFile);
            self.exit(1);
        }

        function afterExtraction() {
            //Get top level contents of cache directory
            var files = fs.readdirSync(cacheDirectory);
            var directoryCount = 0;
            var fileCount = 0;
            var lastDirectory = '';
            files.forEach(function (file) {
                var filePath = cacheDirectory + '/' + file;
                if (fs.statSync(filePath).isDirectory()) {
                    if(filePath == '.' || filePath == '..') {
                        return;
                    }
                    lastDirectory = filePath;
                    directoryCount++;
                } else {
                    fileCount++;
                }
            });

            var sourceDirectory = '';
            // If a single folder is found with no files, use that as the source
            if(directoryCount === 1 && fileCount === 0) {
                sourceDirectory = lastDirectory;
            } else {
                // If more than one folder is found or there are files in the cache directory itself, use the cache directory as the source
                sourceDirectory = cacheDirectory;
            }

            self.installFromDirectory(sourceDirectory, installationDirectory, clean, o, callback);
        }

        switch(archiveExtension.toLowerCase()) {
            case '.tar':
            case '.tgz':
            case '.gz':
                // (npm tar)
                if(!fs.existsSync(cacheDirectory) && !mkdirp.sync(cacheDirectory)) {
                    permaclog('Could not create tar extraction target directory: '+cacheDirectory);
                    this.exit(1);
                }
                tar.extract({file: archiveFile, cwd: cacheDirectory, preservePaths: true}).then(function(err) {
                    if(err) {
                        handleExtractionError(err);
                    } else {
                        afterExtraction();
                    }
                }).catch(function(e) {
                    permaclog('Unable to extract the file: '+archiveFile+' to: '+cacheDirectory);
                    permaclog(e);
                });
                break;
            case '.zip':
                // (npm unzipper)
                fs.createReadStream(archiveFile).pipe(unzipper.Extract({path: cacheDirectory})).on('error', handleExtractionError).on('close', afterExtraction);
                break;
            default:
                permaclog('Unknown archive file type: '+archiveExtension);
        }

        // DID NOT WORK for .tgz / .tar.gz file (tar   [node-tar])
        // var extractor = tar.Extract({
        //     path: cacheDirectory
        // }).on('error', handleExtractionError).on('end', afterExtraction);
        //
        // fs.createReadStream(archiveFile).on('error', handleExtractionError).pipe(extractor);
    },
    installFromRepository: function(repositoryUrl, installationDirectory, clean, o, callback) {
        // todo Handles version scenarios like >, <, >=, <=, =
        // todo Syntax is part of commit-ish like: #>=2.0.0
        // todo Will use node-semver to figure this out - probably will have to clone the repo first and get lists of all tags and branches to use for comparison in a loop

        var meta = {};

        // Separate the commit-ish from the repository URL
        var repositoryUrlParts = URL.parse(repositoryUrl);

        var commitIsh = repositoryUrlParts.hash.replace('#', ''); // get the commit-ish (npm term) from the end of the url
        repositoryUrl = repositoryUrlParts.path;

        var hashedUrl = sha1(repositoryUrl);
        var cacheDirectory = this._getMumCacheDirectory(installationDirectory)+'/'+hashedUrl;

        meta.commitIsh = commitIsh;
        meta.repositoryUrl = repositoryUrl;
        meta.cacheDirectory = cacheDirectory;

        if(!fs.existsSync(cacheDirectory)) {
            //lib.wipeDirectory(cacheDirectory);
            if(! mkdirp.sync(cacheDirectory)) {
                permaclog('Could not create clone target directory: '+cacheDirectory);
                this.exit(1);
            }
        }

        // Check for a git repository inside the target directory
        if(fs.existsSync(cacheDirectory+'/.git')) {
            // Try updating the existing repository clone
            if(this._disableSourceUpdates !== true) {
                this._updateLocalRepository(cacheDirectory, commitIsh);
            } else {
                permaclog('SKIPPING REPOSITORY UPDATE - SOURCE UPDATES DISABLED');
            }
        } else {
            // Try cloning the target repository
            if(!this._cloneRepository(repositoryUrl, cacheDirectory)) {
                permaclog('Could not clone repository: ' + repositoryUrl);
                this.exit(1);
            }
        }

        if(this._disableSourceUpdates !== true) {
            // Attempt to check out the target commitIsh
            this._checkOutCommitIsh(cacheDirectory, commitIsh);
        } else {
            permaclog('SKIPPING REPOSITORY CHECKOUT - SOURCE UPDATES DISABLED');
        }

        // Clone succeeded
        var tmpMumConfigFile = cacheDirectory+'/mum.json';
        // Try to read the mum.json file in the cloned repository to get the name property from it.
        var tmpMumc = this._readMumJson(tmpMumConfigFile);

        // If the dependency options define a custom name use that instead of the one defined by the repository itself.
        if(lib.isPlainObject(o) && o.name) {
            tmpMumc.name = o.name;
        }

        // If not set, don't create a symlink to the cache directory for this repository
        if(tmpMumc.name) {
            // Attempt to create a symlink
            // If the branch or tag is not present then it will return a fatal error and disconnect

            var cacheDirectorySymlink = this._getMumCacheDirectory(installationDirectory)+'/'+tmpMumc.name;

            if(!fs.existsSync(cacheDirectorySymlink)) {

                var cmd = 'ln -s "' + cacheDirectory + '" "' + cacheDirectorySymlink + '"';

                permaclog('Creating repository symlink: ' + cacheDirectorySymlink + ' to ' + cacheDirectory);
                permaclog(cmd);

                try {
                    child_process.execSync(cmd);
                } catch(e) {
                    permaclog('Failed to create repository symlink: ' + cacheDirectorySymlink + ' to ' + cacheDirectory);
                    this.exit(1);
                }
            }
        }

        meta.name = tmpMumc.name;

        permaclog(''); // Empty line in the console for readability

        this.installFromDirectory(cacheDirectory, installationDirectory, clean, o, callback, meta);
    },
    install: function(source, target, clean, o, callback) {
        var installType = '';

        //target = fs.realpathSync(target);

        // @todo - set this new property from other entry points if needed - also set via a method so that it only gets set once per reset
        if(this._baseLevelInstallationDirectory === null) {
            if(!fs.existsSync(target)) {
                mkdirp.sync(target);
            }

            target = fs.realpathSync(target);

            this._baseLevelInstallationDirectory = target; //target.replace(/\/+$/);

            // Write the mumi.json file
            var mumi = {
                source: source,
                target: target
            };

            if(!fs.existsSync(this._baseLevelInstallationDirectory)) {
                mkdirp.sync(this._baseLevelInstallationDirectory);
            }

            permaclog('Base Level Install Dir: '+ this._baseLevelInstallationDirectory);
            permaclog('Mumi.json location: '+ this._baseLevelInstallationDirectory+'/../mumi.json');

            fs.writeFileSync(this._baseLevelInstallationDirectory+'/../mumi.json', JSON.stringify(mumi, null, 4));

            var mumCacheDir = this._baseLevelInstallationDirectory+'/../.mum';
            if(!fs.existsSync(mumCacheDir)) {
                mkdirp.sync(mumCacheDir);
            }
            fs.writeFileSync(mumCacheDir+'/install_to', mumi.target);
        }

        try {
            var stats = fs.statSync(source);
            if(stats.isDirectory()) {
                installType = 'directory';
            } else if(stats.isFile()) {
                installType = 'file';
            } else if(stats.isSymbolicLink()) {
                permaclog('Mum does not currently support installing from symbolic links.');
                this.exit(1);
            }
        } catch(e) {
            installType = 'repository';
        }

        //clog('Install type: ', installType);
        switch(installType) {
            case 'directory':
                // Try installing from that directory
                this.installFromDirectory(source, target, clean, o, callback);
                break;
            case 'file':
                // Try installing from that file as if it were a .tar.gz or a .zip
                this.installFromArchive(source, target, clean, o, callback);
                break;
            case 'repository':
                // Try installing the source as if it were a repository URL
                this.installFromRepository(source, target, clean, o, callback);
                break;
        }
    },
    _runSyncProcess: function(o) {
        var self = this;

        process.env.MUM_CACHE_DIR = this._getMumCacheDirectory();

        var cwd = process.cwd();
        o.beforeInstall.forEach(function(value, index) {
            value.scripts.forEach(function(scriptFile, index) {
                scriptFile = self._resolve(value.directory, scriptFile);
                permaclog('Setting permissions on and attempting to run: '+scriptFile);
                var scriptDir = path.dirname(scriptFile);
                permaclog('Switching directories to: '+scriptDir);
                process.chdir(scriptDir);
                // Force-set executable permissions on the target script file
                child_process.execSync('chmod u+x "'+scriptFile+'"', {stdio: 'inherit'});

                try {
                    // Run the script file as a command
                    permaclog('Executing beforeInstall script: '+scriptFile);
                    child_process.execSync('"' + scriptFile + '"', {stdio: 'inherit'});
                } catch (e) {
                    permaclog(e.stdout);
                    permaclog(e.message);
                    self.exit(1);
                }
            });
        });

        o.beforeSync.forEach(function(value, index) {
            value.scripts.forEach(function(scriptFile, index) {
                scriptFile = self._resolve(value.directory, scriptFile);
                permaclog('Setting permissions on and attempting to run: '+scriptFile);
                var scriptDir = path.dirname(scriptFile);
                permaclog('Switching directories to: '+scriptDir);
                process.chdir(scriptDir);
                // Force-set executable permissions on the target script file
                child_process.execSync('chmod u+x "'+scriptFile+'"', {stdio: 'inherit'});

                try {
                    // Run the script file as a command
                    permaclog('Executing beforeSync script: '+scriptFile);
                    child_process.execSync('"' + scriptFile + '"', {stdio: 'inherit'});
                } catch (e) {
                    permaclog(e.stdout);
                    permaclog(e.message);
                    self.exit(1);
                }
            });
        });
        process.chdir(cwd);

        o.maps.forEach(function(value, index) {
            value = self._legacySupport_convert_installTo_into_target(value);
            // sync source to destination
            lib.overlayFilesRecursive(value.source, value.target, value.excludes, true);
        });
        var scriptSets = ['afterSync', 'afterInstall', 'cleanup'];

        for(var index in scriptSets) {
            if(!scriptSets.hasOwnProperty(index)) {
                continue;
            }
            var scriptSetName = scriptSets[index];
            var scriptSet = o[scriptSetName];

            if(!scriptSet) {
                continue;
            }
            permaclog('Running script set: ' + scriptSetName + '.');
            scriptSet.forEach(function(value, index) {
                value.scripts.forEach(function(scriptFile, index) {
                    scriptFile = self._resolve(value.directory, scriptFile);
                    permaclog('Setting permissions on and attempting to run: ' + scriptFile);
                    var scriptDir = path.dirname(scriptFile);
                    permaclog('Switching directories to: ' + scriptDir);
                    process.chdir(scriptDir);
                    // Force-set executable permissions on the target script file
                    child_process.execSync('chmod u+x "' + scriptFile + '"', {stdio: 'inherit'});

                    try {
                        // Run the script file as a command
                        permaclog('Executing '+scriptSetName+' script: ' + scriptFile);
                        child_process.execSync('"' + scriptFile + '"', {stdio: 'inherit'});
                    } catch(e) {
                        permaclog(e.stdout);
                        permaclog(e.message);
                        self.exit(1);
                    }
                });
            });
        }

        process.chdir(cwd);
    },
    update: function(clean) {
        var mumi = this.getMumiData();

        var self = this;
        // Just run the install again. Installation is smart enough now to skip cloning if it already has a local clone available.
        this.install(mumi.source, mumi.target, clean, undefined, function() {
            self.notifySuccess();
        });
    },
    runDebugOperations: function() {
        this._disableSourceUpdates = true; // Disable source updates for current debugging operations

        var mumi = this.getMumiData();

        // Just run the install again. Installation is smart enough now to skip cloning if it already has a local clone available.
        this.install(mumi.source, mumi.target, false);
    },
    reset: function() {
        this._baseLevelInstallationDirectory = null;
    },
    exit: function(errorCode) {
        if(!errorCode) {

        } else {
            permaclog('ERROR; CODE: '+errorCode);
            this.ding();
            this.wait(500);
            this.ding();
            this.wait(500);
            this.ding();
        }
        process.exit(errorCode);
    },
    notifySuccess: function() {
        permaclog('SUCCESS!');
        this.ding(1);
    },
    notifyAwaitingInput: function() {
        this.ding(2);
    },
    notifyError: function() {
        this.ding(3);
    },
    wait: function(milliseconds) {
        var targetTime = new Date(new Date().getTime() + milliseconds);
        while(targetTime > new Date()){
            // Do nothing, just keep looping until the specified time has elapsed.
        }
    },
    ding: function(numberOfTimes) {
        if(!this._bellEnabled) {
            return;
        }
        if(numberOfTimes === undefined) {
            numberOfTimes = 1;
        }
        while(numberOfTimes > 0) {
            child_process.execSync('tput bel', {stdio: 'inherit'});
            this.wait(50);
            numberOfTimes--;
        }
    },
    printHelp: function(helpDocName) {
        const doc = fs.readFileSync(__dirname+'/help-docs/'+helpDocName+'.txt');
        permaclog(doc);
    }
};
