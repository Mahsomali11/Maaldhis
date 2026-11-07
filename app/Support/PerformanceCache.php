<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use App\Models\Store;
use App\Models\StaffAccount;
use App\Models\SystemSetting;

class PerformanceCache
{
    protected static array $requestMemo = [];

    /**
     * Get cached system branding settings (system_name, system_logo, system_favicon).
     */
    public static function getSystemBranding(): array
    {
        if (isset(self::$requestMemo['system_branding'])) {
            return self::$requestMemo['system_branding'];
        }

        $default = [
            'system_name' => config('app.name', 'Maaldhis'),
            'system_logo' => '',
            'system_favicon' => '',
        ];

        try {
            $branding = Cache::remember('system_branding_settings', 3600, function () use ($default) {
                $result = $default;
                $settings = SystemSetting::whereIn('setting_key', [
                    'platform_name', 'system_name',
                    'platform_logo', 'system_logo',
                    'platform_favicon', 'system_favicon',
                ])->pluck('setting_value', 'setting_key');

                if (!empty($settings['system_name'])) {
                    $result['system_name'] = $settings['system_name'];
                } elseif (!empty($settings['platform_name'])) {
                    $result['system_name'] = $settings['platform_name'];
                }

                $result['system_logo'] = $settings['system_logo'] ?? $settings['platform_logo'] ?? '';
                $result['system_favicon'] = $settings['system_favicon'] ?? $settings['platform_favicon'] ?? '';

                return $result;
            });

            self::$requestMemo['system_branding'] = $branding;
            return $branding;
        } catch (\Throwable $e) {
            return $default;
        }
    }

    public static function forgetSystemBranding(): void
    {
        unset(self::$requestMemo['system_branding']);
        try {
            Cache::forget('system_branding_settings');
        } catch (\Throwable $e) {
        }
    }

    /**
     * Get cached user role, admin status, owned store IDs, and staff store mappings.
     */
    public static function getUserAccessContext(string $userId, ?string $email = null): array
    {
        $memoKey = "user_access:{$userId}";
        if (isset(self::$requestMemo[$memoKey])) {
            return self::$requestMemo[$memoKey];
        }

        $default = [
            'role' => 'staff',
            'is_admin' => false,
            'is_super_admin' => false,
            'admin_role' => null,
            'is_owner' => false,
            'owned_store_ids' => [],
            'assigned_store_id' => null,
            'staff_roles_by_store' => [],
        ];

        try {
            $ctx = Cache::remember("user_access_context:v2:{$userId}", 300, function () use ($userId, $email) {
                $role = 'staff';
                $isAdmin = false;
                $adminRole = null;
                $isOwner = false;
                $assignedStoreId = null;
                $staffRolesByStore = [];

                $adminRow = DB::table('admin_roles')
                    ->where('user_id', $userId)
                    ->where('is_active', true)
                    ->select('role')
                    ->first();

                $ownedStoreIds = Store::where('owner_user_id', $userId)
                    ->pluck('id')
                    ->all();

                $staffQuery = StaffAccount::where('is_active', true)
                    ->where(function ($q) use ($userId, $email) {
                        $q->where('user_id', $userId);
                        if ($email) {
                            $q->orWhere('email', $email);
                        }
                    })
                    ->select('id', 'store_id', 'user_id', 'role')
                    ->get();

                foreach ($staffQuery as $st) {
                    if (empty($st->user_id)) {
                        StaffAccount::where('id', $st->id)->update(['user_id' => $userId]);
                    }
                    $staffRolesByStore[$st->store_id] = $st->role;
                    if (!$assignedStoreId) {
                        $assignedStoreId = $st->store_id;
                    }
                }

                if ($adminRow) {
                    $isAdmin = true;
                    $role = 'super_admin';
                    $adminRole = $adminRow->role;
                    $assignedStoreId = null;
                } elseif (!empty($ownedStoreIds)) {
                    $isOwner = true;
                    $role = 'owner';
                } elseif (!empty($staffRolesByStore) && $assignedStoreId) {
                    $role = $staffRolesByStore[$assignedStoreId] ?? 'staff';
                }

                return [
                    'role' => $role,
                    'is_admin' => $isAdmin,
                    'is_super_admin' => $isAdmin,
                    'admin_role' => $adminRole,
                    'is_owner' => !empty($ownedStoreIds),
                    'owned_store_ids' => $ownedStoreIds,
                    'assigned_store_id' => $assignedStoreId,
                    'staff_roles_by_store' => $staffRolesByStore,
                ];
            });

            self::$requestMemo[$memoKey] = $ctx;
            return $ctx;
        } catch (\Throwable $e) {
            return $default;
        }
    }

    public static function forgetUserAccessContext(?string $userId = null): void
    {
        if ($userId) {
            unset(self::$requestMemo["user_access:{$userId}"]);
            try {
                Cache::forget("user_access_context:{$userId}");
                Cache::forget("user_access_context:v2:{$userId}");
            } catch (\Throwable $e) {
            }
        } else {
            self::$requestMemo = [];
        }
    }

    /**
     * Get cached license and features for a store.
     */
    public static function getStoreLicenseContext(string $storeId): ?array
    {
        $memoKey = "store_license:{$storeId}";
        if (array_key_exists($memoKey, self::$requestMemo)) {
            return self::$requestMemo[$memoKey];
        }

        try {
            $ctx = Cache::remember("store_license_context:{$storeId}", 180, function () use ($storeId) {
                $store = Store::select('id', 'owner_user_id')->find($storeId);
                if (!$store) {
                    return null;
                }

                $license = DB::table('licenses')
                    ->leftJoin('plans', 'licenses.plan_id', '=', 'plans.id')
                    ->where(function ($q) use ($store) {
                        $q->where('licenses.owner_user_id', $store->owner_user_id)
                          ->orWhere('licenses.store_id', $store->id);
                    })
                    ->orderByRaw("CASE WHEN licenses.status != 'suspended' AND licenses.status != 'cancelled' THEN 0 ELSE 1 END")
                    ->orderBy('licenses.expiry_date', 'desc')
                    ->orderBy('licenses.updated_at', 'desc')
                    ->select('licenses.*', 'plans.name as plan_name')
                    ->first();

                if (!$license) {
                    return [
                        'has_license' => false,
                        'status' => 'none',
                        'plan_name' => 'Free',
                        'expiry_date' => null,
                        'days_remaining' => 999,
                        'max_users' => null,
                        'max_devices' => null,
                        'features' => [],
                    ];
                }

                $expiryTimestamp = $license->expiry_date ?? $license->expires_at ?? null;
                $daysRemaining = 999;
                $formattedExpiry = null;
                if ($expiryTimestamp) {
                    $expiryCarbon = \Carbon\Carbon::parse($expiryTimestamp);
                    $formattedExpiry = $expiryCarbon->format('Y-m-d');
                    $diffSeconds = $expiryCarbon->getTimestamp() - now()->getTimestamp();
                    $daysRemaining = (int) ceil($diffSeconds / 86400);
                    if ($daysRemaining === 0) {
                        $daysRemaining = 0;
                    }
                }

                $rawStatus = strtolower($license->status ?? 'active');
                if (in_array($rawStatus, ['suspended', 'cancelled', 'canceled'], true)) {
                    $effectiveStatus = $rawStatus;
                } else {
                    // A license MUST be strictly active whenever days_remaining >= 0 (expiry_date >= now()) and status != 'suspended'
                    $effectiveStatus = ($daysRemaining >= 0) ? 'active' : 'expired';
                    if ($rawStatus !== $effectiveStatus) {
                        try {
                            DB::table('licenses')->where('id', $license->id)->update(['status' => $effectiveStatus]);
                        } catch (\Throwable $e) {
                        }
                    }
                }

                $features = is_string($license->features_enabled)
                    ? (json_decode($license->features_enabled, true) ?: [])
                    : (is_array($license->features_enabled) ? $license->features_enabled : []);

                return [
                    'has_license' => true,
                    'status' => $effectiveStatus,
                    'raw_status' => $rawStatus,
                    'plan_name' => $license->plan_name ?? 'Standard',
                    'expiry_date' => $formattedExpiry ?? $expiryTimestamp,
                    'days_remaining' => $daysRemaining,
                    'max_users' => $license->max_users ?? null,
                    'max_devices' => $license->max_devices ?? null,
                    'features' => $features,
                ];
            });

            self::$requestMemo[$memoKey] = $ctx;
            return $ctx;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function forgetStoreLicenseContext(?string $storeId = null): void
    {
        if ($storeId) {
            unset(self::$requestMemo["store_license:{$storeId}"]);
            try {
                Cache::forget("store_license_context:{$storeId}");
            } catch (\Throwable $e) {
            }
        } else {
            self::$requestMemo = [];
            try {
                $storeIds = DB::table('stores')->pluck('id');
                foreach ($storeIds as $id) {
                    Cache::forget("store_license_context:{$id}");
                }
            } catch (\Throwable $e) {
            }
        }
    }
}

