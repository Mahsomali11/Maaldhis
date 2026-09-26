<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

auth()->loginUsingId('b8d8c15d-e341-4b71-a972-a7dab1355ef0'); // staff user
$response = $kernel->handle(
    Illuminate\Http\Request::create(
        '/api/rest/v1/rpc/get_store_data', 
        'POST', 
        ['store_id' => '01a09566-448c-7075-bd19-ef317d35572e']
    )
);

echo "Response length: " . strlen($response->getContent()) . "\n";
$data = json_decode($response->getContent(), true);
echo "Sales count: " . count($data['sales'] ?? []) . "\n";
echo "Debts count: " . count($data['customerDebts'] ?? []) . "\n";
