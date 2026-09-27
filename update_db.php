<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    Illuminate\Support\Facades\DB::statement("ALTER TABLE stores ADD COLUMN receipt_template VARCHAR(255) DEFAULT 'classic'");
    echo "Column added.\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
