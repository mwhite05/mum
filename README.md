# mum

Currently on version: 0.1.0

Modern Update Manager (for git only at this time)

Gathers dependencies NON-recursively from the target repository using information that matches semver version numbers to tags in git repositories.

In a future major release mum may support recursive dependency fulfilment.

Mum's dependency resolution is only a subset of, but based heavily on the rules defined for [Node JS package definitions](https://docs.npmjs.com/files/package.json#dependencies).
See also [Npm semver](https://docs.npmjs.com/misc/semver)
