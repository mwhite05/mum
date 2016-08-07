# mum

`mum` is short for **M**odern **U**pdate **M**anager

Currently on version: `0.2.4-alpha.2`

---

THIS PAGE IS A WORK IN PROGRESS

Many changes were made to the capabilities of mum and the structure of the
configuration file changed. Updated documentation is coming soon.
(Today's date: 2016-08-07)

---

#### What is mum?

`mum` is a deployment system for software **you** write.

It's primary benefit is being able to deploy directly from any number of private or
public git repositories at specific hashes/branches/tags as required, though
installation from a source directory or tar/zip file is also supported.

The rest of this document presumes you care about consistent and efficient installation
of software to multiple target servers such as multiple dev servers, qa, staging, live,
many machines in an office, etc.

#### Who should use mum to deploy things?
 
The primary target for `mum` is _web applications developers_ who would like to reduce
the tedium of installing their software to a server instance.

Note: The target currently is *nix (mainly Linux) servers.

#### But there are already lots of package managers...

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

## [Project Goals](id:project-goals)

* Provide an deployment (installation _and_ update) system that can run on *nix.
* Software language independence. Use the same tool to install and update from any repository you can access.
* Scriptable. Make custom things happen at specific times before or after deployment.
* Support nested / recursive dependencies.
* Be as fast / efficient as practical (e.g. only clone on initial install, use fetch/pull for updates.)

<br>

**Future**
* Operate quickly using concurrency where possible. (e.g. clone from multiple repositories at once)

---

## Table of Contents

* [Features](#features)
    * [What is "stuff"](#define-stuff)
* [Installing mum](#installing)
    * [Ubuntu / Debian](#installing-debian)
    * [CentOS](#installing-centos)
    * [Mac](#installing-mac)
    * [Windows](#installing-windows)
* [Usage](#usage)
    * [Prerequisites](#usage-prerequisites)
    * [Commands](#usage-commands)
* [Basic Tutorial](#mum-tutorial-basic)
    * [Overview](#tutorial-basic-overview)
    * [Basic Setup](#tutorial-basic-setup)
    * [Installing the Site](#tutorial-basic-installing)
    * [Inspecting the Command](#tutorial-basic-inspecting-command)
* [Advanced Tutorial](#mum-tutorial-advanced)
    * [Overview](#tutorial-advanced-overview)
    * [Basic Setup](#tutorial-advanced-setup)
    * [Installing the Site](#tutorial-advanced-installing)
* [Triggers Tutorial (placeholder)](#mum-tutorial-triggers)
    * [Overview](#tutorial-triggers-overview)
* [Project Motivation](#project-motivation)
* [Project Goals](#project-goals)
* [Mum.json Format](#mum-json)

---


## [Installing mum](id:installing)

Pre-requisites for installing and using mum: `nodejs (v4.x)`, `git`

#### [Debian / Ubuntu](id:installing-debian)

Ensure prerequisites are installed by running:

```
$ curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
$ sudo apt-get install -y nodejs git
```

To install mum for use globally: `sudo npm install -g mum`

To install mum for use only within the current directory: `sudo npm install mum`

#### [CentOS](id:installing-centos)

These instructions are not yet available. If you know what this process should be please submit a pull request with an update to this section of the readme file.

#### [Mac](id:installing-mac)

These instructions are not yet available. If you know what this process should be please submit a pull request with an update to this section of the readme file.

#### [Windows](id:installing-windows)

These instructions are not yet available. If you know what this process should be please submit a pull request with an update to this section of the readme file.


---


## Usage

### [Prerequisites](id:usage-prerequisites)

* A git repository branch or tag that contains the stuff you want to deploy/install somewhere
* A computer/server to install the [stuff](#define-stuff) to


**Optional:**

* [Optional] A `mum.json` in the root directory of your project
See the [mum.json](#mum-json) section below for details on the `mum.json` format.

### [Commands](id:usage-commands)

* **Install -** Run: `sudo mum install <repositoryUrl>#<branchOrTag> <installationDirectory>`
* **CLEAN Install -** Run: `sudo mum install <repositoryUrl>#<branchOrTag> <installationDirectory> clean`
* **Update -** Change directory to the location of a `mumi.json` file and run: `sudo mum update`

**Note:** `mumi.json` files are generated by mum when `mum install` is run. These are _not_ the same as the `mum.json` configuration files you put in your repositories.


---

## [Install from Directory Tutorial](id:install-from-directory)

You can provide a directory path as the source parameter for installation.

e.g. `sudo mum install ~/myproject /var/www/myproject`

---

## [Install from Tarball or Zip Archive Tutorial](id:install-from-archive)

You can provide a zip or tarball file as the source parameter for installation.

e.g. `sudo mum install ~/myproject.zip /var/www/myproject`

e.g. `sudo mum install ~/myproject.tar.gz /var/www/myproject`

---

