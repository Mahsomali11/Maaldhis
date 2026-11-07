<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Ensure view.compiled, log paths, and Inertia devtools always use writable directories
        $compiledPath = config('view.compiled');
        if (!$compiledPath || !is_dir($compiledPath) || !is_writable($compiledPath) || stripos($compiledPath, 'Program Files') !== false) {
            $fallbackViewDir = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis_compiled_views';
            if (!is_dir($fallbackViewDir)) {
                @mkdir($fallbackViewDir, 0777, true);
            }
            config(['view.compiled' => $fallbackViewDir]);
        }

        $logDir = storage_path('logs');
        if (!is_dir($logDir) || !is_writable($logDir) || stripos($logDir, 'Program Files') !== false) {
            $fallbackLogFile = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis-laravel.log';
            config([
                'logging.channels.stack.ignore_exceptions' => true,
                'logging.channels.single.path' => $fallbackLogFile,
                'logging.channels.daily.path' => $fallbackLogFile,
                'logging.channels.emergency.path' => $fallbackLogFile,
            ]);
        }

        // Disable Inertia DevTools file recorder by default and point its storage path to a writable temp folder
        $devtoolsDir = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis_storage' . DIRECTORY_SEPARATOR . 'inertia-devtools';
        if (!is_dir($devtoolsDir)) {
            @mkdir($devtoolsDir, 0777, true);
        }
        config([
            'inertia.devtools.enabled' => false,
            'inertia.devtools.storage.path' => $devtoolsDir,
        ]);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            return;
        }

        $flagFile = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis_storage' . DIRECTORY_SEPARATOR . 'schema_bulk_units_v2.flag';
        if (!is_file($flagFile)) {
            try {
                $migration = include base_path('database/migrations/2026_11_07_182000_add_business_type_and_bulk_units_to_stores_and_items.php');
                if (is_object($migration) && method_exists($migration, 'up')) {
                    $migration->up();
                    @file_put_contents($flagFile, date('c'));
                }
            } catch (\Throwable $e) {
                // Ignore if DB is temporarily unreachable; will retry on next request
            }
        }
    }
}
