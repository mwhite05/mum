#! /usr/bin/php
<?php

$arguments = getopt(join('', ['d:']), []);

if(!array_key_exists('d', $arguments) || !$arguments['d']) {
    echo 'Missing installation directory. Call this script like prepare -d /installation/directory';
    exit(1);
}

$installationDirectory = $arguments['d'];

echo 'PHP: Cleaning up after install to: '.$installationDirectory.PHP_EOL;

# Do your own cleanup work here
