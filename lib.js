'use strict';
const fs = require('fs');
const mkdirp = require('mkdirp');
//const handlebars = require('handlebars');
const path = require('path');
const child_process = require('child_process');
const util = require('./util.js');

module.exports = {
    disableSync: false,

    test: function() {
        this.clog('Testing util.exit(1);');
        util.exit(1);
    },

    error: function(errorMessage, errorCode) {
        this.clog('Error['+errorCode+']: '+errorMessage);
        util.exit(errorCode);
    },

    _mapArgsToObject: function(args, argsMap, command) {
        if(argsMap.length < 1) {
            return args;
        }

        var o = {};

        var _self = this;

        argsMap.forEach(function(arg, index) {
            if(_self.isUndefined(args[index])) {
                if(_self.isDefined(arg.default)) {
                    args[index] = arg.default;
                } else {
                    var message = 'Expected: mum '+command;
                    argsMap.forEach(function(arg) {
                        message += ' <'+arg.name+'>';
                    });
                    _self.error('Missing required argument '+(index+1)+' <'+arg.name+">\n"+message, 0);
                }
            }
            o[arg.name] = args[index];
        });

        return o;
    },

    /**
     * Is the provided value a native JS Array?
     *
     * @param o
     * @returns {boolean}
     */
    isArray: function (o) {
        return (o instanceof Array);
    },

    /**
     * Is the provided value a native JS Object?
     *
     * @param o
     * @returns {boolean}
     */
    isObject: function (o) {
        return (o instanceof Object);
    },

    /**
     * Is the provided value an object of a type that is not an array-like or function-like argument.
     *
     * NOTE: This will return false for any object that is a native JS array, Basix.List object or Function
     *
     * @param o
     * @returns {boolean}
     */
    isPlainObject: function (o) {
        return (this.isObject(o) && !this.isArray(o) && !this.isFunction(o));
    },
    /**
     * Is the provided value a string?
     *
     * @param o
     * @returns {boolean}
     */
    isString: function (o) {
        return (typeof(o) == 'string');
    },

    /**
     * Is the provided value a boolean value? This is a strict check.
     *
     * @param o
     * @returns {boolean}
     */
    isBoolean: function (o) {
        return (o === true || o === false);
    },

    /**
     * Is the provided value a null value? This will return true only for a strict null match.
     * @param o
     * @returns {boolean}
     */
    isNull: function (o) {
        return o === null;
    },

    /**
     * Is the provided value an undefined value? This will return true only for a strict undefined match.
     * @param o
     * @returns {boolean}
     */
    isUndefined: function (o) {
        return typeof(o) === 'undefined';
    },

    isDefined: function(o) {
        return ! this.isUndefined(o);
    },

    isTruthy: function(o) {
        return this.isDefined(o) && o;
    },

    isFalsey: function(o) {
        return this.isUndefined(o) || !o;
    },

    /**
     * Is the provided value a numeric value? This will return true for any valid numeric string.
     *
     * @param o
     * @returns {boolean}
     */
    isNumeric: function (o) {
        if(this.isBoolean(o) || this.isNull() || o === '')
        {
            return false; // Boolean, null, and empty string values are considered numeric by isNaN()
        }
        return (!isNaN(o));
    },
    /**
     * Is the provided value a function?
     *
     * @param o
     * @returns {boolean}
     */
    isFunction: function (o) {
        return (o instanceof Function);
    },
    /**
     * Does the provided key exist in the provided array.
     *
     * NOTE: This currently just maps to jQuery.inArray() and then converts the result to a boolean to make using it less convoluted.
     *
     * @param key
     * @param targetArray
     * @returns {boolean}
     */
    inArray: function (key, targetArray) {
        return jQuery.inArray(key, targetArray) !== -1;
    },

    // initialize preferences file
    initializePreferences: function(appPrefsPath) {
        try {
            var stats = fs.lstatSync(appPrefsPath);
        } catch(e) {
            // Create the file
            this.clog('Initializing preferences file: '+appPrefsPath);
            var defaultPreferences = {};
            this.writePreferences(appPrefsPath, defaultPreferences);
        }
    },

    readPreferencesFromDisk: function(appPrefsPath) {
        return JSON.parse(fs.readFileSync(appPrefsPath));
    },

    writePreferences: function(appPrefsPath, preferences) {
        fs.writeFileSync(appPrefsPath, JSON.stringify(preferences, null, 4));
    },

    clearTerminal: function () {
        process.stdout.write("\u001b[2J\u001b[0;0H");
    },

    clog: util.clog,

    isDirectoryEmpty: function(directory) {
        return (fs.readdirSync(directory).length == 0);
    },

    getDirectoryListing: function (directoryPath, options, listing) {
        var self = this;

        if (typeof(listing) == 'undefined') {
            listing = [];
        }

        var files = fs.readdirSync(directoryPath);

        // @todo - allow overrides of the ignore list via options
        var ignore = [
            '.DS_Store',
            '.git',
            '.placeholder'
        ];

        if(self.isArray(options.ignore)) {
            ignore = options.ignore;
        }

        files.forEach(function (file) {
            if (ignore.indexOf(file) > -1) {
                return;
            }
            var filePath = directoryPath + '/' + file;
            if (fs.statSync(filePath).isDirectory()) {
                listing.push({
                    path: filePath,
                    parentDirectory: path.dirname(filePath),
                    directoryName: path.basename(filePath),
                    type: 'directory'
                });
                self.getDirectoryListing(filePath, options, listing);
            } else {
                listing.push({
                    path: filePath,
                    parentDirectory: path.dirname(filePath),
                    fileName: path.basename(filePath),
                    fileExtension: path.extname(filePath),
                    type: 'file'
                });
            }
        });

        return listing;
    },

    wipeDirectory: function(directory) {
        if(!directory || typeof(directory) !== 'string') {
            return;
        }

        var preResolvedDirectory = directory;

        directory = path.resolve(directory.trim());

        if(directory !== '' && directory !== '/') {
            directory += '/*';
            if(directory === '/*') {
                throw new Error('Attempt to wipe root directory thwarted. Target directory path provided was: "'+preResolvedDirectory+'"');
            }
            var escapedDirectory = directory.replace(' ', '\\ ');
            var cmd = 'rm -rf ' + escapedDirectory;
            child_process.execSync(cmd, {stdio: 'inherit'});
            return;
        }

        throw new Error('Attempt to wipe root directory thwarted. Target directory path provided was: "'+preResolvedDirectory+'"');
    },

    capitalizeWords: function (string) {
        var self = this;
        string = self.toWords(string); // convert hyphens and underscores to spaces first
        var parts = string.split(' ');
        parts.forEach(function (part, index) {
            parts[index] = self.capitalizeFirstWord(part);
        });
        return parts.join(' ');
    },

    capitalizeFirstWord: function (string) {
        string = this.toWords(string);
        return string.substr(0, 1).toUpperCase() + string.substr(1);
    },

    toCamelCase: function (string) {
        string = this.toWords(string);
        return string.replace(/(\s[a-z])/g, function (match) {
            return match.toUpperCase().replace('_', '').replace(' ', '');
        });
    },

    toPascalCase: function (string) {
        string = this.toCamelCase(string);
        return string.substr(0, 1).toUpperCase() + string.substr(1);
    },

    toUnderscore: function (string) {
        string = this.toWords(string);
        return string.replace(/\s+/g, '_');
    },

    toHyphen: function (string) {
        string = this.toWords(string);
        return string.replace(/\s+/g, '-');
    },

    toWords: function (string) {
        return string.replace(/([A-Z]{1,})/g, function (match) {
            return ' ' + match.toLowerCase();
        }).replace(/[_-]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    },

    updatePathName: function(fileName, context) {
        for (var propertyName in context) {
            if (context.hasOwnProperty(propertyName)) {
                fileName = fileName.replace(propertyName, context[propertyName]);
            }
        }
        return fileName;
    },

    overlayFilesRecursive: function (sourcePath, targetPath, excludes, overwrite) {
        var self = this;
        if(this.disableSync === true) {
            self.clog('Skipping recursive overlay of files from: '+sourcePath+ ' to: '+targetPath);
            return true;
        }
        self.clog('Source path: ' + sourcePath);
        self.clog('Target path: ' + targetPath);

        overwrite = (typeof(overwrite) != 'undefined') ? overwrite : false;

        if(!fs.existsSync(sourcePath)) {
            self.clog('Could not find the source directory for overlay operation: '+sourcePath);
            util.exit(1);
        }

        if(! fs.existsSync(targetPath) && ! mkdirp.sync(targetPath)) {
            self.clog('Could not find or create the destination directory for overlay operation: '+targetPath);
            util.exit(1);
        }

        self.clog('Overlaying: ' + sourcePath + ' onto: ' + targetPath);

        if(!(excludes instanceof Array)) {
            excludes = [];
        }

        excludes.forEach(function(value, index) {
            excludes[index] = value.replace(/^\.\//, '');
        });

        // Always exclude these files
        excludes.push('.git');
        excludes.push('.gitignore');
        excludes.push('.placeholder');
        excludes.push('.DS_Store');
        excludes.push('mum.json');
        var excludeFlags = '';
        if (excludes.length) {
            excludeFlags = " --exclude '" + excludes.join("' --exclude '").trim() + "' ";
        }

        // Double quotes used to escape any spaces in the file paths, --ignore-existing used to only copy files that do not already exist
        var ignoreExisting = ' --ignore-existing';
        if(overwrite === true) {
            ignoreExisting = '';
        }
        var $command = 'rsync -vr' + ignoreExisting + excludeFlags + '"' + sourcePath + '/" "' + targetPath + '"';
        try {
            child_process.execSync($command);
        } catch(e) {
            util.exit(1);
        }

        self.clog('Done overlaying files.');
    }
};
