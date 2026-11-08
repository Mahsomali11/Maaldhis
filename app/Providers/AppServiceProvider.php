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

        $dentalFlagFile = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis_storage' . DIRECTORY_SEPARATOR . 'schema_dental_clinic_v1.flag';
        if (!is_file($dentalFlagFile)) {
            try {
                $dentalMigration = include base_path('database/migrations/2026_11_08_122000_create_dental_clinic_tables.php');
                if (is_object($dentalMigration) && method_exists($dentalMigration, 'up')) {
                    $dentalMigration->up();
                    @file_put_contents($dentalFlagFile, date('c'));
                }
            } catch (\Throwable $e) {
                // Ignore if DB is temporarily unreachable; will retry on next request
            }
        }

        $dentalItemsDetailFlag = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis_storage' . DIRECTORY_SEPARATOR . 'schema_dental_items_detail_v1.flag';
        if (!is_file($dentalItemsDetailFlag)) {
            try {
                $detailMigration = include base_path('database/migrations/2026_11_08_134500_add_items_detail_to_treatments_table.php');
                if (is_object($detailMigration) && method_exists($detailMigration, 'up')) {
                    $detailMigration->up();
                    @file_put_contents($dentalItemsDetailFlag, date('c'));
                }
            } catch (\Throwable $e) {
                // Ignore if DB is temporarily unreachable; will retry on next request
            }
        }

        $dentalSyncPaymentsFlag = rtrim(sys_get_temp_dir(), '\\/') . DIRECTORY_SEPARATOR . 'maaldhis_storage' . DIRECTORY_SEPARATOR . 'schema_dental_sync_payments_v1.flag';
        if (!is_file($dentalSyncPaymentsFlag)) {
            try {
                $syncMigration = include base_path('database/migrations/2026_11_08_141000_sync_dental_treatments_payments.php');
                if (is_object($syncMigration) && method_exists($syncMigration, 'up')) {
                    $syncMigration->up();
                    @file_put_contents($dentalSyncPaymentsFlag, date('c'));
                }
            } catch (\Throwable $e) {
                // Ignore if DB is temporarily unreachable; will retry on next request
            }
        }
    }
}
