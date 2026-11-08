<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Support\PerformanceCache;

class DynamicApiController extends Controller
{
    protected function invalidateTableCache(string $table, array $body = [], Request $request = null): void
    {
        if ($table === 'system_settings') {
            PerformanceCache::forgetSystemBranding();
            return;
        }

        if (in_array($table, ['stores', 'staff_accounts', 'admin_roles'], true)) {
            $userId = $body['user_id'] ?? $body['owner_user_id'] ?? ($request ? $request->user()?->id : null);
            if ($userId) {
                PerformanceCache::forgetUserAccessContext($userId);
            }
            if ($request && $request->user()) {
                PerformanceCache::forgetUserAccessContext($request->user()->id);
            }
        }

        if (in_array($table, ['licenses', 'plans', 'subscriptions', 'stores'], true)) {
            PerformanceCache::forgetStoreLicenseContext(null);
        }
    }

    protected function normalizeLicensePayload(array $body, ?object $existingLicense = null): array
    {
        if (isset($body['expiry_date']) && !empty($body['expiry_date'])) {
            try {
                $newExpiry = \Carbon\Carbon::parse($body['expiry_date'])->startOfDay();
                $today = now()->startOfDay();

                if ($existingLicense && !empty($existingLicense->expiry_date)) {
                    $oldExpiry = \Carbon\Carbon::parse($existingLicense->expiry_date)->startOfDay();
                    $oldDaysLeft = (int) ceil(($oldExpiry->getTimestamp() - now()->getTimestamp()) / 86400);

                    // Requirement 1: If current_expiry < now() (already expired) and the extension was added to oldExpiry,
                    // rebase the extension duration onto TODAY (now()).
                    if ($oldDaysLeft < 0 && $newExpiry->gt($oldExpiry) && $newExpiry->lt($today)) {
                        $deltaDays = (int) round($oldExpiry->diffInDays($newExpiry));
                        if ($deltaDays > 0) {
                            $newExpiry = $today->copy()->addDays($deltaDays);
                        }
                    }
                }

                $body['expiry_date'] = $newExpiry->format('Y-m-d');
                $newDaysLeft = (int) ceil(($newExpiry->getTimestamp() - now()->getTimestamp()) / 86400);

                // Requirement 2 & 3: When extended to a valid date (days_left >= 0), automatically set status to 'active'
                if ($newDaysLeft >= 0) {
                    $body['status'] = 'active';
                }
            } catch (\Throwable $e) {
            }
        } elseif (isset($body['status']) && $body['status'] === 'active' && $existingLicense && !empty($existingLicense->expiry_date)) {
            // If activating a license, ensure status stays consistent
            $body['status'] = 'active';
        }

        return $body;
    }

    protected function isSelfStaffAccount(?object $staff, ?object $authUser): bool
    {
        if (!$staff || !$authUser) {
            return false;
        }

        $authUserId = trim((string) ($authUser->id ?? ''));
        $authEmail = strtolower(trim((string) ($authUser->email ?? '')));

        $staffUserId = trim((string) ($staff->user_id ?? ''));
        $staffId = trim((string) ($staff->id ?? ''));
        $staffEmail = strtolower(trim((string) ($staff->email ?? '')));

        if ($authUserId !== '' && ($staffUserId === $authUserId || $staffId === $authUserId)) {
            return true;
        }

        if ($authEmail !== '' && $staffEmail !== '' && $staffEmail === $authEmail) {
            return true;
        }

        return false;
    }

    protected function normalizeItemPayload(array $body, bool $isCreate = false): array
    {
        if (isset($body['retail_price']) && (!isset($body['sell_price']) || $body['sell_price'] === '' || $body['sell_price'] === null)) {
            $body['sell_price'] = $body['retail_price'];
        } elseif (isset($body['sell_price']) && (!isset($body['retail_price']) || $body['retail_price'] === '' || $body['retail_price'] === null)) {
            $body['retail_price'] = $body['sell_price'];
        }

        if ($isCreate) {
            $body['allow_decimal_qty'] = isset($body['allow_decimal_qty']) ? (bool) $body['allow_decimal_qty'] : false;
            $body['base_unit'] = !empty($body['base_unit']) ? trim((string) $body['base_unit']) : 'Piece';
            $body['wholesale_unit'] = !empty($body['wholesale_unit']) ? trim((string) $body['wholesale_unit']) : null;
            $body['conversion_factor'] = isset($body['conversion_factor']) && (float) $body['conversion_factor'] > 0
                ? (float) $body['conversion_factor']
                : 1.000;
            if (array_key_exists('wholesale_price', $body) && ($body['wholesale_price'] === '' || $body['wholesale_price'] === null)) {
                $body['wholesale_price'] = null;
            }
        } else {
            if (array_key_exists('allow_decimal_qty', $body)) {
                $body['allow_decimal_qty'] = (bool) $body['allow_decimal_qty'];
            }
            if (array_key_exists('base_unit', $body)) {
                $body['base_unit'] = !empty($body['base_unit']) ? trim((string) $body['base_unit']) : 'Piece';
            }
            if (array_key_exists('wholesale_unit', $body)) {
                $body['wholesale_unit'] = !empty($body['wholesale_unit']) ? trim((string) $body['wholesale_unit']) : null;
            }
            if (array_key_exists('conversion_factor', $body)) {
                $body['conversion_factor'] = (float) $body['conversion_factor'] > 0 ? (float) $body['conversion_factor'] : 1.000;
            }
            if (array_key_exists('wholesale_price', $body) && ($body['wholesale_price'] === '' || $body['wholesale_price'] === null)) {
                $body['wholesale_price'] = null;
            }
        }

        return $body;
    }

    protected function getModelClass($table)
    {
        // Special cases
        if ($table === 'returns') return '\\App\\Models\\ReturnModel';
        if ($table === 'profiles') return '\\App\\Models\\User'; // Use users table for profiles
        if ($table === 'license_extension_logs') return '\\App\\Models\\LicenseExtension';
        if (in_array($table, ['patients', 'dental_patients'], true)) return '\\App\\Models\\Patient';
        if (in_array($table, ['appointments', 'dental_appointments'], true)) return '\\App\\Models\\Appointment';
        if ($table === 'dental_charts') return '\\App\\Models\\DentalChart';
        if (in_array($table, ['treatments', 'dental_treatments'], true)) return '\\App\\Models\\Treatment';
        if (in_array($table, ['doctors', 'dental_doctors'], true)) return '\\App\\Models\\Doctor';
        if (in_array($table, ['dental_services', 'services'], true)) return '\\App\\Models\\DentalService';
        if (in_array($table, ['dental_items'], true)) return '\\App\\Models\\DentalItem';
        
        $modelName = Str::studly(Str::singular($table));
        $class = '\\App\\Models\\' . $modelName;
        
        if (class_exists($class)) {
            return $class;
        }
        
        abort(404, "Model for table {$table} not found.");
    }

    public function index(Request $request, $table)
    {
        $user = $request->user() ?? auth()->user();
        $access = $user ? PerformanceCache::getUserAccessContext((string) $user->id, $user->email ?? null) : ['is_admin' => false, 'owned_store_ids' => [], 'assigned_store_id' => null, 'staff_roles_by_store' => []];

        // Strictly block non-Super-Admins from querying platform-only admin tables
        if (in_array($table, ['admin_roles', 'platform_payments', 'license_extensions', 'license_extension_logs'], true) && empty($access['is_admin'])) {
            return response()->json(['error' => 'Forbidden: Super Admin access required.'], 403);
        }

        $class = $this->getModelClass($table);
        $query = $class::query();

        // Scope stores query for tenant users so they only ever see their own / assigned stores
        if ($table === 'stores' && empty($access['is_admin'])) {
            $allowedStoreIds = array_values(array_unique(array_filter(array_merge(
                $access['owned_store_ids'] ?? [],
                array_keys($access['staff_roles_by_store'] ?? []),
                !empty($access['assigned_store_id']) ? [$access['assigned_store_id']] : []
            ))));
            $query->whereIn('id', !empty($allowedStoreIds) ? $allowedStoreIds : ['00000000-0000-0000-0000-000000000000']);
        }

        $selectParam = $request->query('select', '*');
        
        // Handle relations in select e.g. "*, profiles!stores_owner_user_id_fkey(email, full_name)"
        if ($selectParam && $selectParam !== '*') {
            $relations = [];
            $selects = [];
            
            // We need a better split that doesn't split inside parentheses
            $parts = preg_split('/,\s*(?![^\(\)]*\))/', $selectParam);
            
            foreach ($parts as $part) {
                $part = trim($part);
                if ($part === '*' || $part === '') continue;
                
                if (preg_match('/^([a-zA-Z0-9_]+)(?:![^\(]+|:[^\(]+)?\((.*?)\)$/', $part, $matches)) {
                    $relation = $matches[1];
                    $cols = $matches[2];
                    $relations[$relation] = $cols;
                } else {
                    $selects[] = $part;
                }
            }
            
            if (!empty($selects)) {
                $query->select($selects);
            }
            
            foreach ($relations as $rel => $cols) {
                $query->with([$rel => function ($q) use ($cols) {
                    if ($cols && $cols !== '*') {
                        // Map columns, making sure we include the primary key 'id' for relation mapping
                        $colArr = array_map('trim', explode(',', $cols));
                        if (!in_array('id', $colArr)) {
                            $colArr[] = 'id';
                        }
                        $q->select($colArr);
                    }
                }]);
            }
        }

        // Apply filters from query params
        foreach ($request->all() as $key => $value) {
            if (in_array($key, ['select', 'order', 'limit', 'or', 'count', 'head'])) continue;
            
            // Format: field=eq.value
            if (is_string($value)) {
                $parsedValue = $value;
                $operator = '=';
                $isWhereIn = false;
                $inItems = [];
                
                if (str_starts_with($value, 'eq.')) {
                    $parsedValue = substr($value, 3);
                } elseif (str_starts_with($value, 'neq.')) {
                    $parsedValue = substr($value, 4);
                    $operator = '!=';
                } elseif (str_starts_with($value, 'in.')) {
                    $inItems = explode(',', trim(substr($value, 3), '()'));
                    $isWhereIn = true;
                }

                // Handle boolean strings
                if ($parsedValue === 'true') $parsedValue = true;
                if ($parsedValue === 'false') $parsedValue = false;
                if ($parsedValue === 'null') $parsedValue = null;

                if ($isWhereIn) {
                    $query->whereIn($key, $inItems);
                } else {
                    $query->where($key, $operator, $parsedValue);
                }
            }
        }

        if ($request->has('or')) {
            $orStr = $request->query('or');
            $parts = explode(',', $orStr);
            $query->where(function ($q) use ($parts) {
                foreach ($parts as $part) {
                    if (str_contains($part, '.eq.')) {
                        [$field, $val] = explode('.eq.', $part);
                        if ($val === 'true') $val = true;
                        if ($val === 'false') $val = false;
                        if ($val === 'null') $val = null;
                        $q->orWhere($field, $val);
                    }
                }
            });
        }

        if ($request->has('order')) {
            $orderParts = explode('.', $request->query('order'));
            $field = $orderParts[0];
            $direction = $orderParts[1] ?? 'asc';
            $query->orderBy($field, $direction);
        }

        $count = null;
        if ($request->has('count') && $request->query('count') === 'exact') {
            $count = $query->count();
            if ($request->has('head') && $request->query('head') === 'true') {
                return response()->json([], 200, ['Content-Range' => "0-0/$count"]);
            }
        }

        if ($request->has('limit')) {
            $query->limit($request->query('limit'));
        }

        $headers = [];
        if ($count !== null) {
            $headers['Content-Range'] = "0-0/$count";
        }

        $results = $query->get();

        // Dynamic License Status Evaluation on read:
        // A license MUST be strictly 'active' whenever expiry_date >= now() (days_left >= 0) and status != 'suspended'.
        if ($table === 'licenses') {
            foreach ($results as $lic) {
                $rawStatus = strtolower($lic->status ?? 'active');
                if (!in_array($rawStatus, ['suspended', 'cancelled', 'canceled'], true)) {
                    $expiryVal = $lic->getRawOriginal('expiry_date') ?? $lic->expiry_date;
                    if ($expiryVal) {
                        $diffSeconds = \Carbon\Carbon::parse($expiryVal)->getTimestamp() - now()->getTimestamp();
                        $daysLeft = (int) ceil($diffSeconds / 86400);
                        $computedStatus = ($daysLeft >= 0) ? 'active' : 'expired';
                        if ($rawStatus !== $computedStatus) {
                            $lic->status = $computedStatus;
                            try {
                                \Illuminate\Support\Facades\DB::table('licenses')
                                    ->where('id', $lic->id)
                                    ->update(['status' => $computedStatus]);
                            } catch (\Throwable $e) {
                            }
                        }
                    }
                }
            }
        }

        return response()->json($results, 200, $headers);
    }

    public function store(Request $request, $table)
    {
        $user = $request->user() ?? auth()->user();
        $access = $user ? PerformanceCache::getUserAccessContext((string) $user->id, $user->email ?? null) : ['is_admin' => false];

        if (in_array($table, ['admin_roles', 'plans', 'system_settings', 'license_extensions', 'license_extension_logs'], true) && empty($access['is_admin'])) {
            return response()->json(['error' => 'Forbidden: Super Admin access required.'], 403);
        }

        if ($table === 'license_extension_logs') {
            return response()->json(['success' => true], 201);
        }

        $class = $this->getModelClass($table);

        // Use only JSON body data, or fallback to POST
        $body = $request->json()->all();
        if (empty($body)) {
            $body = $request->post();
        }

        if ($table === 'items') {
            $body = $this->normalizeItemPayload($body, false);
        } elseif ($table === 'stores' && array_key_exists('business_type', $body)) {
            $body['business_type'] = in_array($body['business_type'], ['standard_retail', 'grocery_bulk', 'dental_clinic'], true)
                ? $body['business_type']
                : 'standard_retail';
        }

        if (is_array($body) && isset($body[0]) && is_array($body[0])) {
            // Check for rapid duplicate bulk insert (e.g. sale_items for the same sale)
            if ($table === 'sale_items' && isset($body[0]['sale_id'])) {
                $existingCount = \Illuminate\Support\Facades\DB::table('sale_items')->where('sale_id', $body[0]['sale_id'])->count();
                if ($existingCount > 0) {
                    \Illuminate\Support\Facades\Log::info("DynamicAPI Deduplicated duplicate sale_items insert for sale: " . $body[0]['sale_id']);
                    return response()->json($body, 201);
                }
            }

            // Bulk insert (array of objects)
            $data = $body;
            $now = now()->format('Y-m-d H:i:s');
            foreach ($data as &$item) {
                if (!isset($item['id']) || empty($item['id'])) {
                    $item['id'] = (string) Str::uuid();
                }
                if (!isset($item['created_at']) || empty($item['created_at'])) {
                    $item['created_at'] = $now;
                } else {
                    try {
                        $item['created_at'] = \Carbon\Carbon::parse($item['created_at'])->format('Y-m-d H:i:s');
                    } catch (\Exception $e) {
                        $item['created_at'] = $now;
                    }
                }
                if (!isset($item['updated_at']) || empty($item['updated_at'])) {
                    $item['updated_at'] = $now;
                } else {
                    try {
                        $item['updated_at'] = \Carbon\Carbon::parse($item['updated_at'])->format('Y-m-d H:i:s');
                    } catch (\Exception $e) {
                        $item['updated_at'] = $now;
                    }
                }
            }
            try {
                $class::insert($data);
                return response()->json($data, 201);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("DynamicAPI Bulk Insert Error: " . $e->getMessage());
                return response()->json(['error' => $e->getMessage()], 500);
            }
        }

        // Rapid duplicate checks (within 2 seconds) for single transaction records
        if ($table === 'sales' && isset($body['store_id'], $body['total'])) {
            $recentSale = \App\Models\Sale::where('store_id', $body['store_id'])
                ->where('total', $body['total'])
                ->where('created_at', '>=', now()->subSeconds(2))
                ->first();
            if ($recentSale) {
                \Illuminate\Support\Facades\Log::info("DynamicAPI Deduplicated duplicate sale insert for store: {$body['store_id']}");
                return response()->json($recentSale, 201);
            }
        }

        if ($table === 'payments' && isset($body['store_id'], $body['amount'])) {
            $paymentQuery = \App\Models\Payment::where('store_id', $body['store_id'])
                ->where('amount', $body['amount'])
                ->where('created_at', '>=', now()->subSeconds(2));
            if (!empty($body['sale_id'])) {
                $paymentQuery->where('sale_id', $body['sale_id']);
            }
            if (!empty($body['customer_id'])) {
                $paymentQuery->where('customer_id', $body['customer_id']);
            }
            $recentPayment = $paymentQuery->first();
            if ($recentPayment) {
                \Illuminate\Support\Facades\Log::info("DynamicAPI Deduplicated duplicate payment insert for store: {$body['store_id']}");
                return response()->json($recentPayment, 201);
            }
        }

        if ($table === 'expenses' && isset($body['store_id'], $body['amount'])) {
            $expenseQuery = \App\Models\Expense::where('store_id', $body['store_id'])
                ->where('amount', $body['amount'])
                ->where('created_at', '>=', now()->subSeconds(2));
            if (!empty($body['expense_type'])) {
                $expenseQuery->where('expense_type', $body['expense_type']);
            }
            $recentExpense = $expenseQuery->first();
            if ($recentExpense) {
                \Illuminate\Support\Facades\Log::info("DynamicAPI Deduplicated duplicate expense insert for store: {$body['store_id']}");
                return response()->json($recentExpense, 201);
            }
        }

        if ($table === 'customer_debts' && isset($body['store_id'], $body['customer_id'], $body['original_amount'])) {
            $debtQuery = \App\Models\CustomerDebt::where('store_id', $body['store_id'])
                ->where('customer_id', $body['customer_id'])
                ->where('original_amount', $body['original_amount'])
                ->where('created_at', '>=', now()->subSeconds(2));
            if (!empty($body['sale_id'])) {
                $debtQuery->where('sale_id', $body['sale_id']);
            }
            $recentDebt = $debtQuery->first();
            if ($recentDebt) {
                \Illuminate\Support\Facades\Log::info("DynamicAPI Deduplicated duplicate customer_debt insert for store: {$body['store_id']}");
                return response()->json($recentDebt, 201);
            }
        }

        // Single insert
        if ($table === 'system_settings' && isset($body['setting_key'])) {
            $existing = \App\Models\SystemSetting::where('setting_key', $body['setting_key'])->first();
            if ($existing) {
                $existing->update([
                    'setting_value' => $body['setting_value'] ?? $existing->setting_value,
                    'description' => $body['description'] ?? $existing->description,
                ]);
                $this->invalidateTableCache($table, $body, $request);
                return response()->json($existing, 200);
            }
        }

        if (!isset($body['id']) || empty($body['id'])) {
            $body['id'] = (string) Str::uuid();
        }
        if (isset($body['created_at']) && !empty($body['created_at'])) {
            try {
                $body['created_at'] = \Carbon\Carbon::parse($body['created_at'])->format('Y-m-d H:i:s');
            } catch (\Exception $e) {
                unset($body['created_at']);
            }
        }
        if (isset($body['updated_at']) && !empty($body['updated_at'])) {
            try {
                $body['updated_at'] = \Carbon\Carbon::parse($body['updated_at'])->format('Y-m-d H:i:s');
            } catch (\Exception $e) {
                unset($body['updated_at']);
            }
        }
        if (isset($body['performed_at']) && !empty($body['performed_at'])) {
            try {
                $body['performed_at'] = \Carbon\Carbon::parse($body['performed_at'])->format('Y-m-d H:i:s');
            } catch (\Exception $e) {
                unset($body['performed_at']);
            }
        }
        if ($table === 'items') {
            $body = $this->normalizeItemPayload($body, true);
        } elseif ($table === 'stores' && empty($body['business_type'])) {
            $body['business_type'] = 'standard_retail';
        } elseif ($table === 'payments') {
            if (isset($body['type']) && !isset($body['payment_type'])) {
                $body['payment_type'] = $body['type'];
                unset($body['type']);
            }
            if (empty($body['payment_type'])) {
                $body['payment_type'] = 'sale';
            }
            if (empty($body['direction'])) {
                $body['direction'] = 'in';
            }
            if (empty($body['created_by'])) {
                $body['created_by'] = $user?->id ?? \Illuminate\Support\Facades\DB::table('users')->value('id');
            }
            // Strip any extraneous fields (such as 'notes' or 'type') not present in the payments table schema
            $validPaymentCols = [
                'id', 'store_id', 'sale_id', 'customer_id', 'supplier_id',
                'payment_type', 'direction', 'method', 'amount', 'reference',
                'created_by', 'created_at', 'updated_at', 'payment_account_id'
            ];
            $body = array_intersect_key($body, array_flip($validPaymentCols));
        }

        try {
            $record = $class::create($body);
            $this->invalidateTableCache($table, $body, $request);
            return response()->json($record, 201);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("DynamicAPI Insert Error: " . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function show($table, $id)
    {
        $class = $this->getModelClass($table);
        return response()->json($class::findOrFail($id));
    }

    public function update(Request $request, $table, $id = null)
    {
        $user = $request->user() ?? auth()->user();
        $access = $user ? PerformanceCache::getUserAccessContext((string) $user->id, $user->email ?? null) : ['is_admin' => false, 'is_owner' => false];

        if (in_array($table, ['admin_roles', 'plans', 'licenses', 'system_settings', 'platform_payments'], true) && empty($access['is_admin'])) {
            return response()->json(['error' => 'Forbidden: Super Admin access required.'], 403);
        }

        $class = $this->getModelClass($table);

        if ($table === 'expenses') {
            $user = $request->user() ?? auth()->user();
            if (!$user) {
                return response()->json(['error' => 'Forbidden'], 403);
            }
            $access = PerformanceCache::getUserAccessContext($user->id, $user->email);
            if (!$access['is_admin'] && !$access['is_owner']) {
                return response()->json(['error' => 'Forbidden: Only Store Owners and Admins are permitted to edit expenses.'], 403);
            }
        }

        // Use only JSON body data, or fallback to POST
        $body = $request->json()->all();
        if (empty($body)) {
            $body = $request->post();
        }

        if ($table === 'items') {
            $body = $this->normalizeItemPayload($body, false);
        } elseif ($table === 'stores' && array_key_exists('business_type', $body)) {
            $body['business_type'] = in_array($body['business_type'], ['standard_retail', 'grocery_bulk', 'dental_clinic'], true)
                ? $body['business_type']
                : 'standard_retail';
        }

        if ($id) {
            $record = $class::findOrFail($id);
            if ($table === 'staff_accounts' && $this->isSelfStaffAccount($record, $user)) {
                return response()->json([
                    'error' => 'Forbidden: You cannot modify your own staff account or role.',
                    'message' => 'Forbidden: You cannot modify your own staff account or role.',
                ], 403);
            }
            if ($table === 'licenses') {
                $body = $this->normalizeLicensePayload($body, $record);
            }
            $record->update($body);

            if ($table === 'licenses' && isset($body['expiry_date'])) {
                try {
                    \Illuminate\Support\Facades\DB::table('subscriptions')
                        ->where('owner_user_id', $record->owner_user_id)
                        ->update([
                            'end_date' => $body['expiry_date'],
                            'status' => $body['status'] ?? 'active',
                        ]);
                } catch (\Throwable $e) {
                }
            }
            
            if ($table === 'plans' && isset($body['features'])) {
                $featuresJson = is_array($body['features']) ? json_encode($body['features']) : $body['features'];
                \Illuminate\Support\Facades\DB::table('licenses')
                    ->where('plan_id', $id)
                    ->update(['features_enabled' => $featuresJson]);
            }

            if ($table === 'staff_accounts') {
                $updatedStaff = $record->fresh();
                $store = \App\Models\Store::find($updatedStaff->store_id);
                if ($store && $store->business_type === 'dental_clinic') {
                    $linkedDoctor = \App\Models\Doctor::where('staff_account_id', $updatedStaff->id)
                        ->orWhere('email', $updatedStaff->email)
                        ->first();

                    if (in_array($updatedStaff->role, ['dentist', 'dental_doctor'], true)) {
                        if ($linkedDoctor) {
                            $linkedDoctor->update([
                                'name' => $updatedStaff->full_name,
                                'email' => $updatedStaff->email,
                                'phone' => $updatedStaff->phone,
                                'is_active' => $updatedStaff->is_active,
                            ]);
                        } else {
                            \App\Models\Doctor::create([
                                'id' => (string) \Illuminate\Support\Str::uuid(),
                                'store_id' => $store->id,
                                'staff_account_id' => $updatedStaff->id,
                                'user_id' => $updatedStaff->user_id,
                                'name' => $updatedStaff->full_name,
                                'specialization' => 'General Dentist',
                                'phone' => $updatedStaff->phone ?? '',
                                'email' => $updatedStaff->email,
                                'working_hours' => 'Mon - Sat: 09:00 AM - 05:00 PM',
                                'is_active' => $updatedStaff->is_active,
                            ]);
                        }
                    } elseif ($linkedDoctor) {
                        $linkedDoctor->update(['is_active' => false]);
                    }
                }
            }

            if ($table === 'doctors') {
                $updatedDoctor = $record->fresh();
                if ($updatedDoctor->staff_account_id) {
                    $staff = \App\Models\StaffAccount::find($updatedDoctor->staff_account_id);
                    if ($staff) {
                        $staff->update([
                            'full_name' => $updatedDoctor->name,
                            'email' => $updatedDoctor->email,
                            'phone' => $updatedDoctor->phone,
                            'is_active' => $updatedDoctor->is_active,
                        ]);
                    }
                }
            }
            
            $this->invalidateTableCache($table, $body, $request);
            return response()->json($record);
        }
        
        $query = $class::query();
        $filtered = false;
        foreach ($request->query() as $key => $value) {
            if (in_array($key, ['select', 'order', 'limit', 'count', 'head'])) continue;
            if (is_string($value) && str_starts_with($value, 'eq.')) {
                $val = substr($value, 3);
                if ($val === 'true') $val = true;
                if ($val === 'false') $val = false;
                if ($val === 'null') $val = null;
                $query->where($key, $val);
                $filtered = true;
            }
        }
        
        if ($filtered) {
            if ($table === 'staff_accounts') {
                $matchingStaff = (clone $query)->get();
                foreach ($matchingStaff as $staffRow) {
                    if ($this->isSelfStaffAccount($staffRow, $user)) {
                        return response()->json([
                            'error' => 'Forbidden: You cannot modify your own staff account or role.',
                            'message' => 'Forbidden: You cannot modify your own staff account or role.',
                        ], 403);
                    }
                }
            }

            if ($table === 'system_settings' && (clone $query)->count() === 0) {
                $settingKey = $body['setting_key'] ?? null;
                if (!$settingKey) {
                    foreach ($request->query() as $k => $v) {
                        if ($k === 'setting_key' && is_string($v) && str_starts_with($v, 'eq.')) {
                            $settingKey = substr($v, 3);
                            break;
                        }
                    }
                }
                if ($settingKey) {
                    $record = \App\Models\SystemSetting::create(array_merge($body, [
                        'id' => (string) Str::uuid(),
                        'setting_key' => $settingKey,
                    ]));
                    $this->invalidateTableCache($table, $body, $request);
                    return response()->json($record);
                }
            }

            if ($table === 'licenses') {
                $existingRecord = (clone $query)->first();
                $body = $this->normalizeLicensePayload($body, $existingRecord);
                $query->update($body);

                if ($existingRecord && isset($body['expiry_date'])) {
                    try {
                        \Illuminate\Support\Facades\DB::table('subscriptions')
                            ->where('owner_user_id', $existingRecord->owner_user_id)
                            ->update([
                                'end_date' => $body['expiry_date'],
                                'status' => $body['status'] ?? 'active',
                            ]);
                    } catch (\Throwable $e) {
                    }
                }
            } else {
                $query->update($body);
            }
            
            if ($table === 'plans' && isset($body['features'])) {
                $planId = null;
                foreach ($request->query() as $key => $value) {
                    if ($key === 'id' && is_string($value) && str_starts_with($value, 'eq.')) {
                        $planId = substr($value, 3);
                        break;
                    }
                }
                if ($planId) {
                    $featuresJson = is_array($body['features']) ? json_encode($body['features']) : $body['features'];
                    \Illuminate\Support\Facades\DB::table('licenses')
                        ->where('plan_id', $planId)
                        ->update(['features_enabled' => $featuresJson]);
                }
            }
            
            $this->invalidateTableCache($table, $body, $request);
            return response()->json(['success' => true]);
        }
        
        return response()->json(['error' => 'Missing ID or filter for update'], 400);
    }

    public function destroy(Request $request, $table, $id = null)
    {
        $class = $this->getModelClass($table);

        if ($table === 'licenses') {
            $user = $request->user() ?? auth()->user();
            if (!$user) {
                return response()->json(['error' => 'Forbidden'], 403);
            }
            $access = PerformanceCache::getUserAccessContext($user->id, $user->email);
            $adminRole = strtolower((string) ($access['admin_role'] ?? ''));
            $isSuperAdmin = $access['is_admin'] && in_array($adminRole, ['super_owner', 'superadmin', 'super_admin'], true);
            if (!$isSuperAdmin) {
                return response()->json([
                    'error' => 'Forbidden: Only Super Admins have permission to delete licenses.',
                    'message' => 'Forbidden: Only Super Admins have permission to delete licenses.',
                ], 403);
            }
        }

        if ($table === 'expenses') {
            $user = $request->user() ?? auth()->user();
            if (!$user) {
                return response()->json(['error' => 'Forbidden'], 403);
            }
            $access = PerformanceCache::getUserAccessContext($user->id, $user->email);
            if (!$access['is_admin'] && !$access['is_owner']) {
                return response()->json(['error' => 'Forbidden: Only Store Owners and Admins are permitted to delete expenses.'], 403);
            }
        }
        
        if ($id) {
            $record = $class::findOrFail($id);
            if ($table === 'staff_accounts') {
                $authUser = $request->user() ?? auth()->user();
                if ($this->isSelfStaffAccount($record, $authUser)) {
                    return response()->json([
                        'error' => 'Forbidden: You cannot delete your own staff account.',
                        'message' => 'Forbidden: You cannot delete your own staff account.',
                    ], 403);
                }

                $doctor = \App\Models\Doctor::where('staff_account_id', $record->id)->first();
                if ($doctor) {
                    $hasAppts = \Illuminate\Support\Facades\DB::table('appointments')->where('doctor_id', $doctor->id)->exists();
                    if ($hasAppts) {
                        $doctor->update(['is_active' => false]);
                    } else {
                        $doctor->delete();
                    }
                }
            }

            if ($table === 'doctors') {
                $hasAppts = \Illuminate\Support\Facades\DB::table('appointments')->where('doctor_id', $record->id)->exists();
                if ($record->staff_account_id) {
                    $staff = \App\Models\StaffAccount::find($record->staff_account_id);
                    if ($staff) {
                        if ($hasAppts) {
                            $staff->update(['is_active' => false]);
                        } else {
                            $staff->delete();
                        }
                    }
                }
                if ($hasAppts) {
                    $record->update(['is_active' => false]);
                    $this->invalidateTableCache($table, [], $request);
                    return response()->json(['message' => 'Doctor has existing appointments and was marked as inactive.'], 200);
                }
            }
            $record->delete();
            $this->invalidateTableCache($table, [], $request);
            return response()->json(null, 204);
        }
        
        $query = $class::query();
        $filtered = false;
        foreach ($request->query() as $key => $value) {
            if (is_string($value) && str_starts_with($value, 'eq.')) {
                $val = substr($value, 3);
                if ($val === 'true') $val = true;
                if ($val === 'false') $val = false;
                if ($val === 'null') $val = null;
                $query->where($key, $val);
                $filtered = true;
            } elseif (is_string($value) && str_starts_with($value, 'in.')) {
                $items = explode(',', trim(substr($value, 3), '()'));
                $query->whereIn($key, $items);
                $filtered = true;
            }
        }
        
        if ($filtered) {
            if ($table === 'staff_accounts') {
                $authUser = $request->user() ?? auth()->user();
                $matchingStaff = (clone $query)->get();
                foreach ($matchingStaff as $staffRow) {
                    if ($this->isSelfStaffAccount($staffRow, $authUser)) {
                        return response()->json([
                            'error' => 'Forbidden: You cannot delete your own staff account.',
                            'message' => 'Forbidden: You cannot delete your own staff account.',
                        ], 403);
                    }
                }
            }
            $query->delete();
            $this->invalidateTableCache($table, [], $request);
            return response()->json(null, 204);
        }
        
        return response()->json(['error' => 'Missing ID or filter for delete'], 400);
    }
}
