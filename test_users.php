<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$users = \App\Models\User::all();
foreach ($users as $u) {
    $isOwner = \App\Models\Store::where('owner_user_id', $u->id)->exists();
    echo $u->email . " - Owner: " . ($isOwner ? 'YES' : 'NO') . "\n";
}
