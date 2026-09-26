<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle(
    $request = Illuminate\Http\Request::create(
        '/test-staff', 'GET'
    )
);

// We will test if the Global Scope runs without errors.
auth()->loginUsingId('01a09566-446d-729b-bd2b-96474b4f37f1'); // owner
echo "Owner Sales Count: " . \App\Models\Sale::count() . "\n";

auth()->loginUsingId('b8d8c15d-e341-4b71-a972-a7dab1355ef0'); // staff
echo "Staff Sales Count: " . \App\Models\Sale::count() . "\n";
