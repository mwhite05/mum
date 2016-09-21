# mum

`mum` is short for **M**odern **U**pdate **M**anager

Currently on version: `0.2.7-alpha`

---

<br>

#### Mum in a nutshell

If you have any need to _consistently replicate a deployment process_ with any level of
complexity or even if you just hate waiting on slow SFTP uploads for every... single...
file then mum may be the solution for you.
<br>
<br>

---

#### Example Usage of Mum

<iframe width="560" height="315" src="https://www.youtube.com/embed/e8mZorhjZSs" frameborder="0" allowfullscreen></iframe>

---

## Table of Contents

* [What is mum?](#what-is-mum)
* [Who should use mum to deploy things?](#who-should-use-mum)
* [But there are already lots of package managers...](#already-package-managers)
* [Project Goals](#project-goals)
* [Installing mum](#installing)
    * [Ubuntu / Debian](#installing-debian)
    * [CentOS](#installing-centos)
    * [Mac OS X](#installing-mac)
* [Usage](#usage)
    * [Key Facts](#key-facts)
    * [Basic Usage](#basic-usage)
        * [Installing from a Directory / Folder](#mum-install-from-directory)
        * [Installing from a Tarball / Zip Archive](#mum-install-from-archive)
        * [Installing from a Git Repository](#mum-install-from-git)
    * [Configuration (optional)](#configuration)
        * [Dependencies](#dependencies)
        * [Install Scripts](#install-scripts)
        * [Install Map](#install-map)
---

<h4 id="what-is-mum">What is mum?</h4>

`mum` is a deployment system for software **you** write.

You might think of mum as an advanced version of `rsync` that can handle different
source types (git, tarballs, zip files), pulling in dependencies your project may have,
syncing files from one location to many target locations, and even running before and
after installation scripts that you write.

It's primary benefit is being able to deploy directly from any number of private or
public git repositories at specific hashes/branches/tags as required, though
installation from a source directory or tar/zip file is also supported.

The rest of this document presumes you care about consistent and efficient installation
of software to multiple target servers such as multiple dev servers, qa, staging, live,
many machines in an office, etc.

<h4 id="who-should-use-mum">Who should use mum to deploy things?</h4>
 
The primary target for `mum` is _web applications developers_ who would like to reduce
the tedium of installing their software to a server instance.

Note: The target currently is *nix (mainly Linux) servers.

If you have any need to consistently replicate a deployment process with any level of
complexity or even if you just hate waiting on slow SFTP uploads for every... single...
file then mum may be the solution for you.

<h4 id="already-package-managers">But there are already lots of package managers...</h4>

Yes, there certainly are. `apt`, `yum`, `npm`, `ruby gems`, `composer`, `pip`, `gopm`
to name a few.

`mum` is _not_ trying to replace them. It is trying to give you a one-stop shop for
deployment of complex systems that often require many packages be installed.

Even _simple_ websites using Wordpress may require many Apache and PHP packages to be
installed. Then you need code from at least two repositories (Wordpress and your
custom site code) or one or two tar/zip files to get the site installed.

Then you need to ensure all the right Apache and PHP modules are actually enabled and
after that you'll need to configure the Apache virtual host.

What if you could turn all of that tedious setup into a single command? If you want to
see how, keep reading.

<h2 id="project-goals">Project Goals</h2>

* Provide an deployment (installation _and_ update) system that can run on *nix.
* Software language independence. Use the same tool to install and update from any repository you can access.
* Scriptable. Make custom things happen at specific times before or after deployment.
* Support nested / recursive dependencies.
* Be as fast / efficient as practical (e.g. only clone on initial install, use fetch/pull for updates.)

<br>

**Future**
* Operate quickly using concurrency where possible. (e.g. clone from multiple repositories at once)

---


<h2 id="installing">Installing mum</h2>

Pre-requisites for installing and using mum: `nodejs (v4.x)`, `git`

<h4 id="installing-debian">Debian / Ubuntu</h4>

Ensure prerequisites are installed by running:

```
$ curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
$ sudo apt-get install -y nodejs git
```

To install mum for use globally: `sudo npm install -g mum`

To install mum for use only within the current directory: `sudo npm install mum`

<h4 id="installing-centos">CentOS</h4>

These instructions are not yet available. If you know what this process should be please submit a pull request with an update to this section of the readme file.

<h4 id="installing-mac">Mac OS X</h4>

These instructions are not yet available. If you know what this process should be please submit a pull request with an update to this section of the readme file.


<h2 id="usage">Usage</h2>

<h3 id="key-facts">Key Facts</h3>

* Mum can install from four different source types
    * Git repository
    * Tarball (.tar, .tgz)
    * Zip archive (.zip)
    * Directory / Folder

<h3 id="basic-usage">Basic usage</h3>

You can use mum for simple projects without even having to create a configuration file!

To install using mum you simply need to have any valid source of files for it to deploy. 

<h4 id="mum-install-from-directory">1. - Installing from a Directory / Folder</h4>

Let's say you have the following directory on your server: `/var/myproject`

You can install that to another location on the same server (let's say `/var/www/html`) by running this command:
 
 `mum install /var/myproject /var/www/html`
 
<h4 id="mum-install-from-archive">2. - Installing from a Tarball / Zip archive</h4>

Let's say you have uploaded or downloaded an archive file with your project in it and saved it to: `/var/myproject.tgz`

You can install to a location on that server (let's say `/var/www/html`) by running this command:

`mum install /var/myproject.tgz /var/www/html`

<h4 id="mum-install-from-git">3. - Installing from a Git Repository</h4>

Let's say you have a Git repository URL to your project (you need the SSH URL, not the HTTPS URL). The URL might be: `git@github.com:mwhite05/wpdemo.git`

You can install directly from your Git repository to a location on your server (let's say `/var/www/html`) by running this command:

`mum install git@github.com:mwhite05/wpdemo.git#master /var/www/html`

    NOTE! It is very important that you include the #<branch|tag|sha1> at the end of your URL.
    This tells mum exactly what to part of your repository to check out and install.

<h4 id="mum-update">4. - Updating Any Mum Installed Project</h4>

The command to update an installed project is the exact same no matter which source type you used for the installation.

Just navigate to the directory _above_ where you installed the project and run:

`mum update`

If you installed to `/var/www/html` then you would change directories to `cd /var/www` then run `mum update`

Need to feel confident that the code is deployed in full with no extraneous files in the primary target area? Run `mum update clean`

Is it time to update to a new branch/tag/hash? Well you could manually modify the `mumi.json` file but as of 0.2.7-alpha you can run `mum update <commitish>`. Alternately run `mum update "#<commitish>"`.

If you need to run a clean and provide a new commit-ish then run: `mum update <commitish> clean` or `mum update "#<commitish>" clean`

<h3 id="configuration">Configuration</h3>

Configuration is optional. You only need configuration to do more advanced things such as:

* Map directories in your project to multiple target destinations (instead of just copying all the files to one target directory)
* Exclude some files / folders from being installed
* Add dependencies to your project so that it can automatically install other files and projects not contained directly in your own project.

The configuration file that mum uses is named `mum.json` and goes directly in the root folder of your project.

Don't worry - mum automatically excludes itself from installing to your target location.

<h4 id="dependencies">Dependencies</h4>

You can add one or more dependencies to your project using the `dependencies` array:

```
{
    "dependencies": [
        {
            "source": "git@github.com:WordPress/WordPress.git#4.6",
            "installTo": "./"
        }
    ]
}
```

Each item in the `dependencies` array _must_ be an object. Every dependency object _must_ contain two properties:

* source - The source to pull for the dependency. This can be any valid mum source type (including Git urls and paths to archive files or directories)
* installTo - The target directory to install to. This can be an absolute path (starting with `/`) or a relative path (starting with `./`). If you set it to a relative path, it will be relative to the target installation directory. If you installed to `/var/www/html` then an installTo value of `./` would install the dependency to `/var/www/html` as well. 

You can have multiple dependencies:

```
{
    "dependencies": [
        {
            "source": "git@github.com:WordPress/WordPress.git#4.6",
            "installTo": "./"
        },
        {
            "source": "git@github.com:mwhite05/mum-example.git#basic",
            "installTo": "./examples"
        }
    ]
}
```

<h4 id="install-scripts">Install Scripts</h4>

If you want to more easily access the mum cache directory for a specific repository you can provide a name for your repository.

When this is provided, mum will create a symlink by that name pointing to the directory containing the local repository clone. If two repositories in the dependency chain have the same name then the behavior is not defined so just be sure that does not happen.

If we named the repository in the above configuration example it might look like this:

```
{
    "name": "my-project",
    "dependencies": [
        {
            "source": "git@github.com:WordPress/WordPress.git#4.6",
            "installTo": "./"
        },
        {
            "source": "git@github.com:mwhite05/mum-example.git#basic",
            "installTo": "./examples"
        }
    ]
}
```

<h4 id="install-scripts">Install Scripts</h4>

You can configure mum to run scripts before and after installation. A script is any executable file (compiled binary executable files work too).

These scripts run as the same user you run `mum install` or `mum update` with (often root) so they can be very powerful.

Let's say you had a project with the following directory structure:

* `index.html`
* `scripts/`
    * `before-install`
    * `after-install-1.py`
    * `after-install-2.php`
* `site/`
    * (misc. site files)

The configuration for running those scripts would be:

```
{
    "install": {
        "scripts": {
            "beforeInstall": [
                "./mum-scripts/before-install"
            ],
            "afterInstall": [
                "./mum-scripts/after-install-1.py",
                "./mum-scripts/after-install-2.php"
            ]
        }
    }
}
```

There are four types of install scripts available:

* beforeInstall - Runs before any files are synced to the target installation directory.
* beforeSync - Runs after `beforeInstall` and before any files are synced to the target installation directory.
* afterSync - Runs after all files are synced to the target installation directory (including files from dependencies)
* afterInstall - Runs after `afterSync` and after all files are synced to the target installation directory (including files from dependencies)

The reason for these different levels is to ensure some level of future flexibility in the API in case new functionality or steps are added and
to allow you to control whether something runs absolutely last or just sort of last when dependencies that _also have scripts_ are involved.

<h4 id="install-map">Install Map</h4>

You can map directories in your project to anywhere you want. By default, if you do not define a map, all of the files
and directories in your project's root directory will by copied to the target installation directory.

You can also exclude files and directories from being copied. This is very useful when you have installation scripts or
configuration files inside your project as you generally do not want those to be deployed as part of your project.

Below is an example of a fairly advanced `mum.json` configuration file that tells mum to copy everything in the project
directory to the target installation directory _but_ it excludes the `mum-scripts/` and `apache` directories.

It then tells mum to also copy everything from the `./apache` directory to the `/etc/apache2/sites-available` directory.

```
{
    "install": {
        "map": [
            {
                "source": "./",
                "installTo": "./",
                "excludes": [
                    "mum-scripts",
                    "apache"
                ]
            },
            {
                "source": "./apache",
                "installTo": "/etc/apache2/sites-available"
            }
        ],
        "scripts": {
            "afterInstall": [
                "./mum-scripts/after-install"
            ]
        }
    },
    "dependencies": [
        {
            "source": "git@github.com:WordPress/WordPress.git#4.6",
            "installTo": "./"
        }
    ]
}
```
