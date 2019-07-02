#! /usr/bin/php
<?php

# Do your custom work here
/**
 * To access the mum variables as $_ENV make sure your php.ini settings for `variables_order` has E at the beginning.
 * Alternatively, you can use the `getenv` function or pull them from the $_SERVER super variable
 */
$env = print_r($_ENV, true);
file_put_contents('/tmp/envdump.txt', $env);
