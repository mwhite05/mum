#!/usr/bin/php
<?php

echo "Packing...".PHP_EOL;

$output = [];
$exitCode = 0;

// Clean up the tests area
$command = './tests/reset';
exec($command.' 2>&1', $output, $exitCode);

// Pack the NPM package
$command = 'npm pack';
exec($command.' 2>&1', $output, $exitCode);

rsort($output);
foreach($output as $line) {
    if(strpos($line, '.tgz') !== false) {
        $packageFileName = trim($line);
    }
}

// Move the package file to the published/ directory (from which we upload to the web server)
exec('mv "'.$packageFileName.'" published/', $output, $exitCode);
$cmd = 'cp "published/'.$packageFileName.'" "published/mum.tgz"';
exec($cmd);
echo $packageFileName.' built.'.PHP_EOL;

echo "When you're ready to post this version live, run: npm publish".PHP_EOL;

/*// Parse version from file name
$versionString = str_replace(['mum-', '.tgz'], '', $packageFileName);

// Update latest.json
file_put_contents('published/latest.json', json_encode(['version' => $versionString]));

echo "Latest version file updated.".PHP_EOL;*/
