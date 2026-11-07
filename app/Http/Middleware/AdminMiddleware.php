<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * AdminMiddleware — protects all /admin/* routes.
 * Ensures the authenticated user has an active record in admin_roles.
 * Redirects unauthenticated users to /admin/login.
 * Returns 403 for authenticated non-admin users.
 */
class AdminMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        // Must be authenticated
        if (!Auth::check()) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
            return redirect()->route('admin.login');
        }

        $user = Auth::user();
        $ctx = \App\Support\PerformanceCache::getUserAccessContext((string) $user->id, $user->email ?? null);
        $isAdmin = $ctx['is_admin'];

        if (!$isAdmin) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'message' => 'Access denied. You are not a platform administrator.',
                ], 403);
            }

            // Strictly redirect Store Admin / Cashier / Store Owner to their Store Client Portal
            return redirect('/dashboard');
        }

        return $next($request);
    }
}
