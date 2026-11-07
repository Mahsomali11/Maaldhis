<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);
        $middleware->api(append: [
            \App\Http\Middleware\PreventDuplicateSubmissions::class,
        ]);
        $middleware->api(remove: [
            \Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class,
        ]);
        
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);

        $middleware->redirectUsersTo('/dashboard');

        $middleware->redirectGuestsTo('/login');

        // Named middleware aliases
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'block_admin' => \App\Http\Middleware\BlockAdminMiddleware::class,
            'role' => \App\Http\Middleware\RoleMiddleware::class,
            'prevent_duplicates' => \App\Http\Middleware\PreventDuplicateSubmissions::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });
    })->create();

// When installed inside Windows "Program Files", the default storage directory is read-only
// for non-elevated web workers (like Herd's php-cgi.exe). Route storagePath() to a writable directory.
$defaultStorage = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
if (stripos($defaultStorage, 'Program Files') !== false || !is_writable($defaultStorage)) {
    $writableStorage = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis_storage';
    $storageSubdirs = [
        $writableStorage,
        $writableStorage . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'public',
        $writableStorage . DIRECTORY_SEPARATOR . 'app' . DIRECTORY_SEPARATOR . 'private',
        $writableStorage . DIRECTORY_SEPARATOR . 'framework' . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR . 'data',
        $writableStorage . DIRECTORY_SEPARATOR . 'framework' . DIRECTORY_SEPARATOR . 'sessions',
        $writableStorage . DIRECTORY_SEPARATOR . 'framework' . DIRECTORY_SEPARATOR . 'testing',
        $writableStorage . DIRECTORY_SEPARATOR . 'framework' . DIRECTORY_SEPARATOR . 'views',
        $writableStorage . DIRECTORY_SEPARATOR . 'logs',
        $writableStorage . DIRECTORY_SEPARATOR . 'inertia-devtools',
    ];
    foreach ($storageSubdirs as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
    }
    $app->useStoragePath($writableStorage);
}

return $app;
