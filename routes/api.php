<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\DynamicApiController;
use App\Http\Controllers\AuthController;
use App\Http\Middleware\AdminMiddleware;

// ============================================================
// PUBLIC API AUTH ROUTES — No authentication required
// ============================================================

// Normal user API login (token-based, for mobile/external clients)
Route::post('/login', [AuthController::class, 'login']);
Route::post('/signup', [AuthController::class, 'signup']);
Route::post('/auth/v1/signup-with-store', [AuthController::class, 'signupWithStore']);
Route::post('/auth/v1/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

// ============================================================
// AUTHENTICATED USER API ROUTES
// ============================================================

Route::middleware(['auth:sanctum'])->group(function () {

    // Returns current user profile + computed role
    Route::get('/user', function (Request $request) {
        $user = $request->user();
        
        $role = 'staff';
        $assigned_store_id = null;
        $admin_role = null;

        // 1. Check if user is a platform admin
        $adminRow = DB::table('admin_roles')
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->first();

        if ($adminRow) {
            $role = 'admin';
            $admin_role = $adminRow->role; // 'super_owner', 'admin', 'support'
        } else {
            // 2. Check if user is an owner of any store
            $isOwner = \App\Models\Store::where('owner_user_id', $user->id)->exists();
            if ($isOwner) {
                $role = 'owner';
            } else {
                // 3. Check if user is staff
                $staff = \App\Models\StaffAccount::where('user_id', $user->id)
                    ->where('is_active', true)
                    ->first();
                    
                if ($staff) {
                    $role = $staff->role;
                    $assigned_store_id = $staff->store_id;
                }
            }
        }

        return array_merge($user->toArray(), [
            'role'              => $role,
            'admin_role'        => $admin_role,
            'assigned_store_id' => $assigned_store_id,
            'email'             => $user->email,
            'full_name'         => $user->full_name ?? $user->name,
        ]);
    });

    // Create staff user
    Route::post('/auth/v1/create-staff', [AuthController::class, 'createStaff']);
    Route::post('/auth/v1/update-staff-password', [AuthController::class, 'updateStaffPassword']);

    // Process Return
    Route::post('/rest/v1/process-return', [\App\Http\Controllers\ReturnController::class, 'processReturn']);

    // Dynamic REST API — protected by store access check for normal users
    // Admin users bypass store scoping (they can access all data)
    Route::middleware([\App\Http\Middleware\CheckStoreAccess::class])->group(function () {
        
        // Fast optimized endpoint to get all store data in one request
        Route::post('/rest/v1/rpc/get_store_data', function (Request $request) {
            $storeId = $request->input('_store_id') ?? $request->input('store_id');
            if (!$storeId) return response()->json(['error' => 'Store ID is required'], 400);

            return response()->json([
                'items' => \App\Models\Item::where('store_id', $storeId)->get(),
                'customers' => \App\Models\Customer::where('store_id', $storeId)->get(),
                'suppliers' => \App\Models\Supplier::where('store_id', $storeId)->get(),
                'expenses' => \App\Models\Expense::where('store_id', $storeId)->orderBy('created_at', 'desc')->get(),
                'sales' => \App\Models\Sale::where('store_id', $storeId)->orderBy('sold_at', 'desc')->get(),
                // sale_items doesn't have store_id directly, get via sales
                'saleItems' => \App\Models\SaleItem::whereIn('sale_id', \App\Models\Sale::where('store_id', $storeId)->pluck('id'))->get(),
                'customerDebts' => \App\Models\CustomerDebt::where('store_id', $storeId)->get(),
                'payments' => \App\Models\Payment::where('store_id', $storeId)->orderBy('created_at', 'desc')->get(),
                'returns' => \App\Models\ReturnModel::where('store_id', $storeId)->get(),
                'staffAccounts' => \App\Models\StaffAccount::where('store_id', $storeId)->get(),
                'stockTransfers' => \App\Models\StockTransfer::where(function($q) use ($storeId) {
                    $q->where('source_store_id', $storeId)->orWhere('destination_store_id', $storeId);
                })->orderBy('created_at', 'desc')->get(),
                'categories' => \App\Models\Category::where('store_id', $storeId)->orderBy('created_at', 'asc')->get(),
            ]);
        });

        Route::get('/rest/v1/{table}', [DynamicApiController::class, 'index']);
        Route::post('/rest/v1/{table}', [DynamicApiController::class, 'store']);
        Route::patch('/rest/v1/{table}', [DynamicApiController::class, 'update']);
        Route::delete('/rest/v1/{table}', [DynamicApiController::class, 'destroy']);
        
        Route::post('/upload-image', function (Request $request) {
            $request->validate([
                'image' => 'required|file|mimes:jpeg,png,jpg,svg,webp|max:2048',
                'folder' => 'required|string|in:store-logos,product-images',
            ]);
            
            $file = $request->file('image');
            $folder = $request->input('folder');
            
            $path = $file->store($folder, 'public');
            
            return response()->json([
                'path' => $path,
                'url' => asset('storage/' . $path)
            ]);
        });
    });

    // Diagnostic route
    Route::get('/test-data', function (Request $request) {
        $user = $request->user();
        return response()->json([
            'user'   => $user,
            'stores' => \App\Models\Store::where('owner_user_id', $user->id)->get(),
        ]);
    });
});
