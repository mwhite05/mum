'use strict';
const fs = require('fs');
const unzip = require('unzip2');
const zlib = require('zlib');
const targz = require('tar.gz');
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

/* RULES:
        * Any variable named *Directory is a path to a directory.
        * Directory paths do _not_ end in a trailing slash.
        * Any variable named *File is a path to a file.
        * Any variable named *Url is a URL to a resource.
        * Relative directory and file paths are expanded at the earliest possible moment.
*/

module.exports = {
    _baseLevelInstallationDirectory: null,
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
        source: null,
        installTo: null,
        config: {}
    },
    /**
    * A commit-ish can be any of: sha-1 hash for a specific commit, branch name, tag name.
    * If the commit-ish portion of the URL is blank or left of entirely, the default is master.
    *
    */
    _cloneRepository: function(repositoryUrl, cloneTargetDirectory) {
        lib.wipeDirectory(cloneTargetDirectory);

        // If the branch or tag is not present then it will return a fatal error and disconnect
        var cmd = 'git clone "' + repositoryUrl + '" "' + cloneTargetDirectory + '"';

        clog(cmd);

        try {
            child_process.execSync(cmd);
        } catch(e) {
            return false;
        }

        return true;
    },
    _checkOutCommitIsh: function(repositoryPath, commitIsh) {
        // If the hash, branch or tag is not present then it will return a fatal error and disconnect
        var cmd = 'git checkout "' + commitIsh+'"';

        clog(cmd);

        try {
            var cwd = process.cwd();
            // Change directories to the target directory (which should be home to a git repository)
            process.chdir(repositoryPath);
            // Run the checkout command
            child_process.execSync(cmd);
            // Change directories back to the original working directory
            process.chdir(cwd);
        } catch(e) {
            return false;
        }

        return true;
    },
    _updateLocalRepository: function(repositoryPath, commitIsh) {
        // If the hash, branch or tag is not present then it will return a fatal error and disconnect
        var cmds = [];
        cmds.push('git fetch');
        cmds.push('git checkout "' + commitIsh+'"');
        cmds.push('git pull');

        try {
            var cwd = process.cwd();
            // Change directories to the target directory (which should be home to a git repository)
            process.chdir(repositoryPath);
            // Run the commands
            cmds.forEach(function(cmd, index) {
                clog(cmd);
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
    _validateSourceDirectory: function(directory) {
        if(! fs.existsSync(directory)) {
            clog('The source directory could not be found: '+directory);
            process.exit(1);
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
    _getMumCacheDirectory: function(installationDirectory) {
        var mumDirectory = this._resolve(this._baseLevelInstallationDirectory, '../.mum');
        if(!fs.existsSync(mumDirectory)) {
            mkdirp.sync(mumDirectory);
        }
        return mumDirectory;
    },
    installFromDirectory: function(sourceDirectory, installationDirectory, clean) {
        var self = this;

        clean = (typeof(clean) != 'undefined');
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
        var cwd = process.cwd();
        process.chdir(installationDirectory);
        mumc.install.scripts.before.forEach(function(scriptFile, index) {
            var scriptFile = self._resolve(sourceDirectory, scriptFile);
            // Force-set executable permissions on the target script file
            clog(child_process.execSync('chmod u+x "'+scriptFile+'"').toString());
            clog(child_process.execSync('"'+scriptFile+'"').toString());
        });
        process.chdir(cwd);

        // loop over each item in the installMap
        mumc.install.map.forEach(function(value, index) {
            // resolve the path for source
            var source = self._resolve(sourceDirectory, value.source);
            // resolve the path for destination
            var destination = self._resolve(installationDirectory, value.installTo);

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
        cwd = process.cwd();
        process.chdir(installationDirectory);
        mumc.install.scripts.after.forEach(function(scriptFile, index) {
            var scriptFile = self._resolve(sourceDirectory, scriptFile);
            // Force-set executable permissions on the target script file
            clog(child_process.execSync('chmod u+x "'+scriptFile+'"').toString());
            clog(child_process.execSync('"'+scriptFile+'"').toString());
        });
        process.chdir(cwd);

        clog('Installed from '+sourceDirectory+' to '+installationDirectory);

        clog('Checking for dependencies.');

        if(mumc.dependencies.length) {
            clog('Found dependencies.');
            mumc.dependencies.forEach(function(dependency, index) {
                var dep = extend({}, self._defaultMumDependency, dependency);
                if(dep.installTo[0] == '.') {
                    dep.installTo = installationDirectory+'/'+dep.installTo;
                }
                clog('Installing dependency from: ', dep.source, ' to ', dep.installTo);
                self.install(dep.source, dep.installTo);
            });
        }
    },
    installFromArchive: function(archiveFile, installationDirectory) {
        archiveFile = path.resolve(archiveFile);
        installationDirectory = path.resolve(installationDirectory);

        var archiveExtension = path.extname(archiveFile);

        var cacheDirectory = this._getMumCacheDirectory(installationDirectory) + '/' + path.basename(archiveFile);

        var self = this;

        function handleExtractionError(error) {
            clog(error);
            clog('Could not extract the archive: '+archiveFile);
            process.exit(1);
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

            self.installFromDirectory(sourceDirectory, installationDirectory);
        }

        switch(archiveExtension.toLowerCase()) {
            case '.tar':
            case '.tgz':
            case '.gz':
                // (npm tar.gz)
                targz().extract(archiveFile, cacheDirectory, function(err) {
                    if(err) {
                        handleExtractionError(err);
                    } else {
                        afterExtraction();
                    }
                });
                break;
            case '.zip':
                // (npm unzip2)
                fs.createReadStream(archiveFile).pipe(unzip.Extract({path: cacheDirectory})).on('error', handleExtractionError).on('close', afterExtraction);
                break;
            default:
                clog('Unknown archive file type: '+archiveExtension);
        }

        // DID NOT WORK for .tgz / .tar.gz file (tar   [node-tar])
        // var extractor = tar.Extract({
        //     path: cacheDirectory
        // }).on('error', handleExtractionError).on('end', afterExtraction);
        //
        // fs.createReadStream(archiveFile).on('error', handleExtractionError).pipe(extractor);
    },
    installFromRepository: function(repositoryUrl, installationDirectory) {

        // Handles version scenarios like >, <, >=, <=, =
        // Syntax is part of commit-ish like: #>=2.0.0
        // Will use node-semver to figure this out - probably will have to clone the repo first and get lists of all tags and branches to use for comparison in a loop
        // Clone of initial repository should be to specific (known) location so that the directory name does not conflict with that of any named dependencies

        // Separate the commit-ish from the repository URL
        var repositoryUrlParts = URL.parse(repositoryUrl);

        var commitIsh = repositoryUrlParts.hash.replace('#', ''); // get the commit-ish (npm term) from the end of the url
        repositoryUrl = repositoryUrlParts.path;

        var hashedUrl = sha1(repositoryUrl);
        var cacheDirectory = this._getMumCacheDirectory(installationDirectory)+'/'+hashedUrl;

        if(!fs.existsSync(cacheDirectory)) {
            //lib.wipeDirectory(cacheDirectory);
            if(! mkdirp.sync(cacheDirectory)) {
                clog('Could not create clone target directory: '+cacheDirectory);
                process.exit(1);
            }
        }

        // Check for a git repository inside the target directory
        if(fs.existsSync(cacheDirectory+'/.git')) {
            // Try updating the existing repository clone
            this._updateLocalRepository(cacheDirectory, commitIsh);
        } else {
            // Try cloning the target repository
            if(!this._cloneRepository(repositoryUrl, cacheDirectory)) {
                clog('Could not clone repository: ' + repositoryUrl);
                process.exit(1);
            }
        }

        // Attempt to check out the target commitIsh
        this._checkOutCommitIsh(cacheDirectory, commitIsh);

        clog(''); // Empty line in the console for readability

        this.installFromDirectory(cacheDirectory, installationDirectory);
    },
    install: function(source, target) {
        var installType = '';

        //target = fs.realpathSync(target);

        // @todo - set this new property from other entry points - also set via a method so that it only gets set once per reset
        if(this._baseLevelInstallationDirectory === null) {
            this._baseLevelInstallationDirectory = target.replace(/\/+$/);

            // Write the mumi.json file
            var mumi = {
                source: source,
                installTo: target
            };

            fs.writeFileSync('./mumi.json', JSON.stringify(mumi));
        }

        try {
            clog('checking for a directory or file: ', source);
            //var tmpSource = fs.realpathSync(source);
            var stats = fs.statSync(source);
            //clog(stats);
            if(stats.isDirectory()) {
                installType = 'directory';
            } else if(stats.isFile()) {
                installType = 'file';
            } else if(stats.isSymbolicLink()) {
                clog('Mum does not currently support installing from symbolic links.');
                process.exit(1);
            }
        } catch(e) {
            installType = 'repository';
        }

        clog('Install type: ', installType);
        switch(installType) {
            case 'directory':
                // Try installing from that directory
                this.installFromDirectory(source, target);
                break;
            case 'file':
                // Try installing from that file as if it were a .tar.gz or a .zip
                this.installFromArchive(source, target);
                break;
            case 'repository':
                // Try installing the source as if it were a repository URL
                this.installFromRepository(source, target);
                break;
        }
    },
    update: function() {
        if(!fs.existsSync('./mumi.json')) {
            clog('Unable to update. Could not find instructions file: '+process.cwd()+'/mumi.json');
            process.exit(1);
        }

        var mumi = JSON.parse(fs.readFileSync('./mumi.json'));
        if(!lib.isObject(mumi)) {
            clog('Unable to update. mumi.json contents are not a valid JSON object.');
            process.exit(1);
        }

        // Just run the install again. Installation is smart enough now to skip cloning if it already has a local clone available.
        this.install(mumi.source, mumi.installTo);
    },
    resetBaseLevelInstallationDirectory: function() {
        this._baseLevelInstallationDirectory = null;
    }
};
