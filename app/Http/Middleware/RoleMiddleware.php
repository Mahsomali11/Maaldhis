<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use App\Support\PerformanceCache;

/**
 * RoleMiddleware — Enforces strict role and portal separation between:
 * - Platform Super Admins (`role:super_admin`, backed by `admin_roles` table)
 * - Tenant Store Users (`role:admin`, `role:owner`, `role:cashier`, `role:inventory_manager`, `role:staff`)
 */
class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (!Auth::check()) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
            $requiresSuperAdmin = in_array('super_admin', $roles, true);
            return redirect($requiresSuperAdmin ? '/admin/login' : '/login');
        }

        $user = Auth::user();
        $ctx = PerformanceCache::getUserAccessContext((string) $user->id, $user->email ?? null);
        $isSuperAdmin = (bool) ($ctx['is_admin'] ?? false);

        // Normalize allowed roles (handle comma-separated or variadic arguments)
        $allowedRoles = [];
        foreach ($roles as $r) {
            foreach (explode(',', $r) as $part) {
                $trimmed = strtolower(trim($part));
                if ($trimmed !== '') {
                    $allowedRoles[] = $trimmed;
                }
            }
        }

        // Case 1: Route group requires Platform Super Admin (`role:super_admin`)
        if (in_array('super_admin', $allowedRoles, true) && count($allowedRoles) === 1) {
            if (!$isSuperAdmin) {
                if ($request->expectsJson() || $request->is('api/*')) {
                    return response()->json([
                        'error' => 'Forbidden: Super Admin access required.',
                        'message' => 'Access denied. You are not a platform administrator.',
                    ], 403);
                }
                // Strictly redirect Store Admin / Cashier / Owner to their Store Client Portal
                return redirect('/dashboard');
            }

            return $next($request);
        }

        // Case 2: Route group is for Tenant Store Portal (`role:admin`, `role:owner`, `role:cashier`, etc.)
        if ($isSuperAdmin && !in_array('super_admin', $allowedRoles, true)) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'error' => 'Forbidden: Platform administrators must use the Super Admin portal.',
                ], 403);
            }
            return redirect('/admin/dashboard');
        }

        if (empty($allowedRoles)) {
            return $next($request);
        }

        $userStoreRole = strtolower((string) ($ctx['is_owner'] ? 'owner' : ($ctx['role'] ?? 'staff')));

        // Store Owners ('owner') implicitly satisfy Store Admin ('admin') requirements within their store
        $effectiveRoles = [$userStoreRole, 'staff'];
        if ($userStoreRole === 'owner') {
            $effectiveRoles[] = 'admin';
        }

        $isAuthorized = !empty(array_intersect($effectiveRoles, $allowedRoles));

        if (!$isAuthorized) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'error' => 'Forbidden: Insufficient store role permissions.',
                ], 403);
            }
            return redirect('/dashboard');
        }

        return $next($request);
    }
}

