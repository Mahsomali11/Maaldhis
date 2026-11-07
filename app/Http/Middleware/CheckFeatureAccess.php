<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\DB;
use App\Models\Store;

class CheckFeatureAccess
{
    /**
     * Map database tables / API endpoints to Feature Keys.
     * This matches the frontend ALL_FEATURES keys.
     */
    protected array $tableFeatureMap = [
        'sales' => 'pos_sales',
        'sale_items' => 'pos_sales',
        'items' => 'inventory',
        'categories' => 'inventory',
        'purchases' => 'purchases',
        'purchase_items' => 'purchases',
        'customers' => 'customers',
        'customer_debts' => 'credit_sales',
        'expenses' => 'expenses',
        'cash_sessions' => 'cash_flow',
        'cash_movements' => 'cash_flow',
        'account_transfers' => 'account_transfers',
        'staff_accounts' => 'staff_accounts',
        'stock_transfers' => 'stock_transfers',
        'suppliers' => 'suppliers',
        'returns' => 'returns',
        // other tables like stores, profiles, plans are core/admin
    ];

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $table = $request->route('table');
        
        // If it's not a dynamic REST table route, or not mapped to a specific feature, allow it.
        // Some core tables like 'stores', 'payment_accounts' are always allowed.
        if (!$table || !isset($this->tableFeatureMap[$table])) {
            return $next($request);
        }

        $featureKey = $this->tableFeatureMap[$table];

        // Get the requested store ID
        $requestedStoreId = $request->query('store_id') 
            ?? $request->input('store_id') 
            ?? $request->query('eq.store_id') 
            ?? $request->input('eq.store_id');

        if (!$requestedStoreId) {
            // If we can't determine the store, we can't check its features.
            // CheckStoreAccess handles the store presence, so we'll just pass here.
            return $next($request);
        }

        if (is_string($requestedStoreId) && str_starts_with($requestedStoreId, 'eq.')) {
            $requestedStoreId = substr($requestedStoreId, 3);
        }

        $licCtx = \App\Support\PerformanceCache::getStoreLicenseContext($requestedStoreId);
        if ($licCtx === null) {
            return response()->json(['error' => 'Store not found'], 404);
        }

        // If no license system applied yet, assume all features enabled (backward compatibility)
        if (!$licCtx['has_license'] || $licCtx['status'] === 'none') {
            return $next($request);
        }

        $rawStatus = strtolower($licCtx['raw_status'] ?? $licCtx['status'] ?? '');

        // Explicitly block if status is suspended or cancelled
        if (in_array($rawStatus, ['suspended', 'canceled', 'cancelled'], true)) {
            return response()->json(['error' => 'License expired or suspended. Please renew your subscription.'], 403);
        }

        // Dynamic License Status Evaluation:
        // Days Left calculation: ceil((expiry_date - now()) in days).
        // If days_left >= 0 and status != 'suspended', the license status is ACTIVE and user access MUST be granted instantly.
        $expiryTimestamp = $licCtx['expiry_date'] ?? null;
        if ($expiryTimestamp) {
            $diffSeconds = \Carbon\Carbon::parse($expiryTimestamp)->getTimestamp() - now()->getTimestamp();
            $daysLeft = (int) ceil($diffSeconds / 86400);
            if ($daysLeft < 0) {
                return response()->json(['error' => 'License expired or suspended. Please renew your subscription.'], 403);
            }
        } elseif (($licCtx['days_remaining'] ?? 0) < 0 || strtolower($licCtx['status'] ?? '') === 'expired') {
            return response()->json(['error' => 'License expired or suspended. Please renew your subscription.'], 403);
        }

        $features = $licCtx['features'] ?? [];

        // If features is somehow invalid or empty, deny
        if (!is_array($features) || empty($features)) {
            return response()->json(['error' => 'Feature not enabled in your current plan.'], 403);
        }

        if (!isset($features[$featureKey]) || $features[$featureKey] !== true) {
            return response()->json(['error' => "Forbidden: The '{$featureKey}' feature is not enabled in your current subscription plan."], 403);
        }

        return $next($request);
    }
}
