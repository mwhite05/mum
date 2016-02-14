# mum

Currently on version: 0.1.0

Modern Update Manager (for git only at this time)

## Motivation

Today's software is often comprised of many sub-components and it can be a challenge to manage those dependencies and ensure smooth installation and updates.

Also, if you're like me you don't work with a single "stack" of software anymmore. You might leverage PHP, Python, NodeJS, Go, C, C++, etc. across different server environments.

There are many installation and dependency resolution systems in the wild:

* apt (Debian)
* yum (CentOS / RedHat)
* npm (NodeJS)
* Composer (PHP)
* pip (Python)
* gopm (Go)

These systems all have their place and mum is **not** trying to actually replace them.

Instead, the goal of mum is to give you a way to wrangle all those separate tools into an automated workflow.

Additionally, some software may be stashed away in private access git repositories and so none of the tools above are a good fit there either.

The overarching goal for mum is to provide a single interface with a clean and efficient way to deploy code to any environment from local machines up to production servers for any languages you work with.

Please be aware that this does **not** mean mum is written in all languages. Mum will remain as a nodeJS package that is capable of installing from git repositories.

---

NPM is a popular package manager and chances are; if you found this mum package you already know how npm dependency resolution works.

Because of that fact, mum aims to support at least a subset of the dependency resolution behavior that npm uses. Please note that mum has some distinct differences from the way npm works so in those areas the mum dependency resolution will differ as required.

* [Node JS package definitions](https://docs.npmjs.com/files/package.json#dependencies).
* [Npm semver](https://docs.npmjs.com/misc/semver)

## Goals

* Provide an update manager that can run on *nix and Windows.
* Language independence. Use the same install tool and update manager for any repository you can access.
* Triggers. React to installation and update triggers within your own software packages.
* Support recursive dependencies with cyclic dependency prevention.
* Support conflict detection in dependency resolution.
* Operate quickly using concurrency where possible. (e.g. clone from multiple repositories at once)
