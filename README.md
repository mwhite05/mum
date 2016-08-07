# mum

`mum` is short for **M**odern **U**pdate **M**anager

Currently on version: `0.2.5-alpha`

---

THIS PAGE IS A WORK IN PROGRESS

Many changes were made to the capabilities of mum and the structure of the
configuration file changed. Updated documentation is coming soon.
(Today's date: 2016-08-07)

---

## Table of Contents

* [What is mum?](#what-is-mum)
* [Who should use mum to deploy things?](#two)
* [But there are already lots of package managers...](#three)
* [Project Goals](#project-goals)
* [Installing mum](#installing)
    * [Ubuntu / Debian](#installing-debian)
    * [CentOS](#installing-centos)
    * [Mac](#installing-mac)
    * [Windows](#installing-windows)

---

#### [What is mum?](id:one)

`mum` is a deployment system for software **you** write.

It's primary benefit is being able to deploy directly from any number of private or
public git repositories at specific hashes/branches/tags as required, though
installation from a source directory or tar/zip file is also supported.

The rest of this document presumes you care about consistent and efficient installation
of software to multiple target servers such as multiple dev servers, qa, staging, live,
many machines in an office, etc.

#### [Who should use mum to deploy things?](id:two)
 
The primary target for `mum` is _web applications developers_ who would like to reduce
the tedium of installing their software to a server instance.

Note: The target currently is *nix (mainly Linux) servers.

#### [But there are already lots of package managers...](id:three)

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
