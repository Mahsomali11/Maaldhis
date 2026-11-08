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

// Public endpoint to retrieve system branding (name, logo, favicon)
Route::get('/system-branding', function () {
    return response()->json(\App\Support\PerformanceCache::getSystemBranding());
});

// ============================================================
// AUTHENTICATED USER API ROUTES
// ============================================================

Route::middleware(['auth:sanctum'])->group(function () {

    // Returns current user profile + computed role (cached)
    Route::get('/user', function (Request $request) {
        $user = $request->user();
        $access = \App\Support\PerformanceCache::getUserAccessContext($user->id, $user->email);

        return array_merge($user->only(['id', 'name', 'full_name', 'email', 'phone', 'created_at']), [
            'role'              => $access['role'],
            'admin_role'        => $access['admin_role'],
            'is_admin'          => (bool) ($access['is_admin'] ?? false),
            'is_super_admin'    => (bool) ($access['is_admin'] ?? false),
            'assigned_store_id' => $access['assigned_store_id'],
            'email'             => $user->email,
            'full_name'         => $user->full_name ?? $user->name,
        ]);
    });

    // Create staff user
    Route::post('/auth/v1/create-staff', [AuthController::class, 'createStaff']);
    Route::post('/auth/v1/update-staff-password', [AuthController::class, 'updateStaffPassword']);

    // Process Return, Purchase, Transfers, and Expense Reversals
    Route::post('/rest/v1/process-return', [\App\Http\Controllers\ReturnController::class, 'processReturn']);
    Route::post('/rest/v1/process-purchase', [\App\Http\Controllers\PurchaseController::class, 'processPurchase']);
    Route::post('/rest/v1/return-purchase', [\App\Http\Controllers\PurchaseController::class, 'returnPurchase']);
    Route::post('/rest/v1/purchases/{id}/return', [\App\Http\Controllers\PurchaseController::class, 'returnPurchase']);
    Route::post('/rest/v1/delete-purchase', [\App\Http\Controllers\PurchaseController::class, 'deletePurchase']);
    Route::delete('/rest/v1/purchases/{id}', [\App\Http\Controllers\PurchaseController::class, 'deletePurchase']);
    Route::post('/rest/v1/pay-supplier-debt', [\App\Http\Controllers\PurchaseController::class, 'paySupplierDebt']);
    Route::post('/rest/v1/process-transfer', [\App\Http\Controllers\TransferController::class, 'processTransfer']);
    Route::post('/rest/v1/refund-expense', [\App\Http\Controllers\ExpenseController::class, 'refundExpense']);
    Route::post('/rest/v1/expenses/{id}/refund', [\App\Http\Controllers\ExpenseController::class, 'refundExpense']);
    Route::patch('/rest/v1/expenses/{id}', [\App\Http\Controllers\ExpenseController::class, 'update']);
    Route::delete('/rest/v1/expenses/{id}', [\App\Http\Controllers\ExpenseController::class, 'destroy']);
    // Receipt Details Lookup (by ID, receipt_no RCP-..., or customer debt)
    Route::get('/rest/v1/receipt-details/{identifier}', [\App\Http\Controllers\SaleController::class, 'getReceiptDetails']);
    Route::get('/receipt-details/{identifier}', [\App\Http\Controllers\SaleController::class, 'getReceiptDetails']);

    // Dynamic REST API — protected by store access check for normal users
    // Admin users bypass store scoping (they can access all data)
    Route::middleware([
        \App\Http\Middleware\CheckStoreAccess::class,
        \App\Http\Middleware\CheckFeatureAccess::class
    ])->group(function () {
        
        // Fast cached store license & feature check endpoint
        Route::post('/rest/v1/rpc/get_store_license', function (Request $request) {
            $storeId = $request->input('_store_id') ?? $request->input('store_id');
            if (!$storeId) return response()->json(['error' => 'Store ID is required'], 400);

            $licenseCtx = \App\Support\PerformanceCache::getStoreLicenseContext($storeId);
            $licenseStatusObj = [
                'status' => $licenseCtx['status'] ?? 'none',
                'plan_name' => $licenseCtx['plan_name'] ?? 'Free',
                'expiry_date' => $licenseCtx['expiry_date'] ?? null,
                'days_remaining' => $licenseCtx['days_remaining'] ?? 999,
                'max_users' => $licenseCtx['max_users'] ?? null,
                'max_devices' => $licenseCtx['max_devices'] ?? null,
                'features' => $licenseCtx['features'] ?? [],
            ];
            return response()->json([
                'status' => $licenseStatusObj,
                'features' => $licenseCtx['features'] ?? [],
            ]);
        });

        // Fast optimized endpoint to get all store data in one request
        Route::post('/rest/v1/rpc/get_store_data', function (Request $request) {
            $storeId = $request->input('_store_id') ?? $request->input('store_id');
            if (!$storeId) return response()->json(['error' => 'Store ID is required'], 400);

            // Fetch only lightweight or necessary historical data (limit to recent 500 to prevent bloat)
            $recentSales = \App\Models\Sale::where('store_id', $storeId)->orderBy('sold_at', 'desc')->take(500)->get();
            $recentSalesIds = $recentSales->pluck('id');
            $purchases = \App\Models\Purchase::where('store_id', $storeId)->orderBy('created_at', 'desc')->take(200)->get();
            $purchaseIds = $purchases->pluck('id');
            $licenseCtx = \App\Support\PerformanceCache::getStoreLicenseContext($storeId);
            $licenseStatusObj = [
                'status' => $licenseCtx['status'] ?? 'none',
                'plan_name' => $licenseCtx['plan_name'] ?? 'Free',
                'expiry_date' => $licenseCtx['expiry_date'] ?? null,
                'days_remaining' => $licenseCtx['days_remaining'] ?? 999,
                'max_users' => $licenseCtx['max_users'] ?? null,
                'max_devices' => $licenseCtx['max_devices'] ?? null,
                'features' => $licenseCtx['features'] ?? [],
            ];

            $hasPatients = \Illuminate\Support\Facades\Schema::hasTable('patients');
            $hasServices = \Illuminate\Support\Facades\Schema::hasTable('dental_services');
            $hasDentalItems = \Illuminate\Support\Facades\Schema::hasTable('dental_items');
            $hasTreatments = \Illuminate\Support\Facades\Schema::hasTable('treatments');
            $hasAppointments = \Illuminate\Support\Facades\Schema::hasTable('appointments');
            $hasDentalCharts = \Illuminate\Support\Facades\Schema::hasTable('dental_charts');
            $hasDoctors = \Illuminate\Support\Facades\Schema::hasTable('doctors');

            return response()->json([
                'items' => \App\Models\Item::with(['subCategory:id,store_id,name,parent_id'])->where('store_id', $storeId)->get(),
                'customers' => \App\Models\Customer::where('store_id', $storeId)->get(),
                'suppliers' => \App\Models\Supplier::where('store_id', $storeId)->get(),
                'expenses' => \App\Models\Expense::with(['user:id,name,full_name', 'refunder:id,name,full_name'])->where('store_id', $storeId)->orderBy('created_at', 'desc')->take(500)->get(),
                'sales' => $recentSales,
                // sale_items doesn't have store_id directly, get via sales
                'saleItems' => $recentSalesIds->isEmpty() ? [] : \App\Models\SaleItem::whereIn('sale_id', $recentSalesIds)->get(),
                'customerDebts' => \App\Models\CustomerDebt::where('store_id', $storeId)->get(),
                'payments' => \App\Models\Payment::with('user:id,name,full_name')->where('store_id', $storeId)->orderBy('created_at', 'desc')->take(500)->get(),
                'returns' => \App\Models\ReturnModel::where('store_id', $storeId)->orderBy('created_at', 'desc')->take(200)->get(),
                'staffAccounts' => \App\Models\StaffAccount::where('store_id', $storeId)->get(),
                'stockTransfers' => \App\Models\StockTransfer::where(function($q) use ($storeId) {
                    $q->where('source_store_id', $storeId)->orWhere('destination_store_id', $storeId);
                })->orderBy('created_at', 'desc')->take(200)->get(),
                'categories' => \App\Models\Category::where('store_id', $storeId)->orderBy('created_at', 'asc')->get(),
                'purchases' => $purchases,
                'purchaseItems' => $purchaseIds->isEmpty() ? [] : \App\Models\PurchaseItem::whereIn('purchase_id', $purchaseIds)->get(),
                'accountTransfers' => \App\Models\AccountTransfer::where('store_id', $storeId)->orderBy('created_at', 'desc')->take(200)->get(),
                'paymentAccounts' => \App\Models\PaymentAccount::where('store_id', $storeId)->get(),
                'patients' => $hasPatients ? \App\Models\Patient::where('store_id', $storeId)->orderBy('created_at', 'desc')->get() : [],
                'dentalServices' => $hasServices ? \App\Models\DentalService::where('store_id', $storeId)->get() : [],
                'dentalItems' => $hasDentalItems ? \App\Models\DentalItem::where('store_id', $storeId)->get() : [],
                'treatments' => $hasTreatments ? \App\Models\Treatment::where('store_id', $storeId)->orderBy('created_at', 'desc')->take(300)->get() : [],
                'appointments' => $hasAppointments ? \App\Models\Appointment::where('store_id', $storeId)->orderBy('appointment_date', 'asc')->get() : [],
                'dentalCharts' => $hasDentalCharts ? \App\Models\DentalChart::where('store_id', $storeId)->get() : [],
                'doctors' => $hasDoctors ? \App\Models\Doctor::where('store_id', $storeId)->get() : [],
                'licenseStatus' => $licenseStatusObj,
                'storeFeatures' => $licenseCtx['features'] ?? [],
            ]);
        });

        Route::get('/dental/doctors', [\App\Http\Controllers\DoctorController::class, 'index']);
        Route::post('/dental/doctors', [\App\Http\Controllers\DoctorController::class, 'store']);
        Route::put('/dental/doctors/{id}', [\App\Http\Controllers\DoctorController::class, 'update']);
        Route::delete('/dental/doctors/{id}', [\App\Http\Controllers\DoctorController::class, 'destroy']);

        Route::get('/dental/services', [\App\Http\Controllers\DentalCatalogController::class, 'getServices']);
        Route::post('/dental/services', [\App\Http\Controllers\DentalCatalogController::class, 'storeService']);
        Route::put('/dental/services/{id}', [\App\Http\Controllers\DentalCatalogController::class, 'updateService']);
        Route::delete('/dental/services/{id}', [\App\Http\Controllers\DentalCatalogController::class, 'destroyService']);

        Route::get('/dental/items', [\App\Http\Controllers\DentalCatalogController::class, 'getItems']);
        Route::post('/dental/items', [\App\Http\Controllers\DentalCatalogController::class, 'storeItem']);
        Route::put('/dental/items/{id}', [\App\Http\Controllers\DentalCatalogController::class, 'updateItem']);
        Route::delete('/dental/items/{id}', [\App\Http\Controllers\DentalCatalogController::class, 'destroyItem']);

        Route::get('/dental/patients/{id}', [\App\Http\Controllers\PatientController::class, 'show']);
        Route::put('/dental/patients/{id}', [\App\Http\Controllers\PatientController::class, 'update']);

        Route::get('/rest/v1/{table}', [DynamicApiController::class, 'index']);
        Route::post('/rest/v1/{table}', [DynamicApiController::class, 'store']);
        Route::patch('/rest/v1/{table}', [DynamicApiController::class, 'update']);
        Route::delete('/rest/v1/{table}', [DynamicApiController::class, 'destroy']);
        
        Route::post('/upload-image', function (Request $request) {
            $request->validate([
                'image' => [
                    'required',
                    'file',
                    'max:350',
                    function ($attribute, $value, $fail) {
                        if ($value->getSize() > 350000) {
                            $fail('Image size must not exceed 350KB.');
                            return;
                        }
                        $ext = strtolower($value->getClientOriginalExtension());
                        $allowedExts = ['jpeg', 'png', 'jpg', 'svg', 'webp', 'ico'];
                        if (!in_array($ext, $allowedExts)) {
                            $fail('The image must be a file of type: jpeg, png, jpg, svg, webp, ico.');
                        }
                    },
                ],
                'folder' => 'required|string|in:store-logos,product-images,system-branding',
            ], [
                'image.max' => 'Image size must not exceed 350KB.',
            ]);
            
            $file = $request->file('image');
            $folder = $request->input('folder');
            
            $ext = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $file->getClientOriginalExtension()));
            // Create a unique filename
            $filename = uniqid() . '_' . time() . '.' . $ext;
            
            $rawContents = @file_get_contents($file->getRealPath());
            $mimeMap = [
                'jpg'  => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png'  => 'image/png',
                'svg'  => 'image/svg+xml',
                'webp' => 'image/webp',
                'ico'  => 'image/x-icon',
            ];
            $mimeType = $mimeMap[$ext] ?? ($file->getMimeType() ?: 'image/png');

            $destinationDir = public_path('uploads/' . $folder);
            try {
                if (!is_dir($destinationDir)) {
                    @mkdir($destinationDir, 0777, true);
                }

                if (is_dir($destinationDir) && is_writable($destinationDir)) {
                    // Move directly to public/uploads folder to avoid storage symlink issues on shared hosting
                    $file->move($destinationDir, $filename);
                    $path = 'uploads/' . $folder . '/' . $filename;
                    return response()->json([
                        'path' => $path,
                        'url' => '/' . $path
                    ]);
                }
            } catch (\Throwable $e) {
                // Fallback to inline data URI when running inside a read-only Program Files directory
            }

            $dataUri = 'data:' . $mimeType . ';base64,' . base64_encode($rawContents ?: '');
            return response()->json([
                'path' => $dataUri,
                'url' => $dataUri,
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
