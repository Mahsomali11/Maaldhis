<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$u = App\Models\User::where('email', 'asxaabteyda@gmail.com')->first();
$u->password = Hash::make('password123');
$u->save();
echo "Password updated!\n";
