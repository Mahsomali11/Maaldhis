<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckStoreAccess
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            \Illuminate\Support\Facades\Log::warning("CheckStoreAccess 401: No user. URL: " . $request->fullUrl() . " Cookie: " . json_encode($request->cookie()));
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // 1. Determine requested store_id from query or body
        $requestedStoreId = $request->query('store_id') 
            ?? $request->input('store_id') 
            ?? $request->query('eq.store_id') 
            ?? $request->input('eq.store_id');
            
        // Some endpoints like /api/rest/v1/stores might not have store_id but ID itself
        if ($request->route('table') === 'stores') {
            $requestedStoreId = $request->query('id') ?? $request->input('id') ?? $request->query('eq.id') ?? $request->input('eq.id');
        }

        if (!$requestedStoreId || in_array($request->route('table'), ['profiles'])) {
            // If the endpoint doesn't specify a store_id, we either pass it through or 
            // the endpoint must handle authorization itself. 
            // For now, let it pass (e.g. GET /api/user).
            $request->attributes->set('store_role', 'guest');
            return $next($request);
        }

        // Clean eq. from parsed values if any
        if (is_string($requestedStoreId) && str_starts_with($requestedStoreId, 'eq.')) {
            $requestedStoreId = substr($requestedStoreId, 3);
        }

        $ctx = \App\Support\PerformanceCache::getUserAccessContext((string) $user->id, $user->email ?? null);

        // 1b. Platform admins have full access
        if ($ctx['is_admin']) {
            $request->attributes->set('store_role', 'admin');
            return $next($request);
        }

        // 2. Check if user is an owner of this store
        $isOwner = in_array($requestedStoreId, $ctx['owned_store_ids'], true)
            || \App\Models\Store::where('id', $requestedStoreId)->where('owner_user_id', $user->id)->exists();
            
        if ($isOwner) {
            $request->attributes->set('store_role', 'owner');
            return $next($request);
        }

        // 3. Check if user is staff for this store (cached or DB fallback)
        $staffRole = $ctx['staff_roles_by_store'][$requestedStoreId] ?? null;
        if (!$staffRole) {
            $staff = \App\Models\StaffAccount::where('store_id', $requestedStoreId)
                ->where('is_active', true)
                ->where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)->orWhere('email', $user->email);
                })
                ->first();
            if ($staff) {
                if (empty($staff->user_id)) {
                    $staff->update(['user_id' => $user->id]);
                }
                $staffRole = $staff->role;
                \App\Support\PerformanceCache::forgetUserAccessContext((string) $user->id);
            }
        }

        if ($staffRole) {
            $request->attributes->set('store_role', $staffRole);
            
            // Check basic role restrictions for the entire store
            if (in_array($request->route('table'), ['stores', 'staff_accounts']) && $request->method() !== 'GET') {
                if ($staffRole !== 'admin') {
                    return response()->json(['error' => 'Forbidden: You do not have permission to modify store settings or staff.'], 403);
                }
            }
            
            return $next($request);
        }

        \Illuminate\Support\Facades\Log::warning("CheckStoreAccess 403: Forbidden for user " . $user->id . " Store: " . $requestedStoreId);
        return response()->json(['error' => 'Forbidden: You do not have access to this store'], 403);
    }
}
