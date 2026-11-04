<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $role = null;
        $admin_role = null;
        $assigned_store_id = null;
        $initialStores = [];

        if ($user) {
            $ctx = \App\Support\PerformanceCache::getUserAccessContext($user->id, $user->email ?? null);
            $role = $ctx['role'];
            $admin_role = $ctx['admin_role'];
            $assigned_store_id = $ctx['assigned_store_id'];

            if (!$ctx['is_admin']) {
                $storeFields = [
                    'id', 'owner_user_id', 'store_name', 'store_code', 'location', 'phone',
                    'currency', 'logo_url', 'show_logo_on_receipt', 'receipt_thank_you_message',
                    'receipt_footer_text', 'receipt_template', 'primary_color', 'secondary_color',
                    'country', 'tax_enabled', 'tax_rate', 'low_stock_threshold', 'created_at',
                ];
                try {
                    if ($ctx['is_owner']) {
                        $initialStores = \App\Models\Store::select($storeFields)
                            ->where('owner_user_id', $user->id)
                            ->get();
                    } elseif ($assigned_store_id) {
                        $initialStores = \App\Models\Store::select($storeFields)
                            ->where('id', $assigned_store_id)
                            ->get();
                    }
                } catch (\Throwable $e) {
                }
            }
        }

        $systemBranding = \App\Support\PerformanceCache::getSystemBranding();

        return [
            ...parent::share($request),
            'systemBranding' => $systemBranding,
            'initialStores' => $initialStores,
            'auth' => [
                'user' => $user ? array_merge($user->only(['id', 'name', 'full_name', 'email', 'phone', 'created_at']), [
                    'full_name' => $user->full_name ?? $user->name,
                    'role' => $role,
                    'admin_role' => $admin_role,
                    'assigned_store_id' => $assigned_store_id,
                ]) : null,
            ],
            'flash' => [
                'message' => fn () => $request->session()->get('message'),
                'error' => fn () => $request->session()->get('error'),
                'success' => fn () => $request->session()->get('success'),
            ],
        ];
    }
}
