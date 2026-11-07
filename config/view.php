<?php

$defaultViewCompiled = env('VIEW_COMPILED_PATH', realpath(storage_path('framework/views')) ?: storage_path('framework/views'));

// On Windows when hosted inside "C:\Program Files\...", non-elevated web server workers (Herd php-cgi)
// may not have write permissions to storage/framework/views, causing tempnam() to fall back to
// sys_get_temp_dir() and trigger ErrorException: "tempnam(): file created in the system's temporary directory".
if (!is_dir($defaultViewCompiled) || !is_writable($defaultViewCompiled) || stripos($defaultViewCompiled, 'Program Files') !== false) {
    $fallbackViewDir = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis_compiled_views';
    if (!is_dir($fallbackViewDir)) {
        @mkdir($fallbackViewDir, 0777, true);
    }
    if (is_dir($fallbackViewDir)) {
        $defaultViewCompiled = $fallbackViewDir;
    }
}

return [
    'paths' => [
        resource_path('views'),
    ],

    'compiled' => $defaultViewCompiled,
];

