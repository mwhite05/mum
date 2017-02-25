#! /usr/bin/php
<?php

# Do your custom work here
$env = print_r($_ENV, true);
file_put_contents('/tmp/envdump.txt', $env);
