<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Item;
use App\Models\Expense;
use App\Models\Store;
use Illuminate\Support\Str;

class PurchaseController extends Controller
{
    private function isUserAdminOrOwner(Request $request, string $storeId): bool
    {
        $user = $request->user() ?? auth()->user();
        if (!$user) {
            return false;
        }

        $access = \App\Support\PerformanceCache::getUserAccessContext((string) $user->id, $user->email);
        if (!empty($access['is_admin']) || !empty($access['is_owner'])) {
            return true;
        }

        $store = Store::find($storeId);
        if ($store && (string) $store->owner_user_id === (string) $user->id) {
            return true;
        }

        return DB::table('staff_accounts')
            ->where('store_id', $storeId)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->whereIn('role', ['admin', 'owner'])
            ->exists();
    }

    private function resolvePurchaseItemMeta(PurchaseItem $pi, ?Item $item, bool $isGroceryStore): array
    {
        if (!$isGroceryStore) {
            $qty = round((float) $pi->quantity, 0);
            return [
                'unit_type' => 'base',
                'unit_name' => 'Piece',
                'conversion_factor' => 1.0,
                'base_quantity' => $qty,
            ];
        }

        $baseUnitName = $item?->base_unit ?: 'KG';
        $wholesaleUnitName = $item?->wholesale_unit ? trim((string) $item->wholesale_unit) : '';
        $itemFactor = max(0.001, (float) ($item?->conversion_factor ?? 1.0));

        if ($pi->base_quantity !== null && (float) $pi->base_quantity >= 0 && !empty($pi->unit_type)) {
            $factor = max(0.001, (float) ($pi->conversion_factor ?? ($pi->unit_type === 'wholesale' ? $itemFactor : 1.0)));
            return [
                'unit_type' => $pi->unit_type,
                'unit_name' => $pi->unit_name ?: ($pi->unit_type === 'wholesale' && $wholesaleUnitName ? $wholesaleUnitName : $baseUnitName),
                'conversion_factor' => $factor,
                'base_quantity' => round((float) $pi->base_quantity, 3),
            ];
        }

        // Heuristic fallback for legacy purchase_items recorded before unit_type/base_quantity columns existed
        $isLegacyWholesale = false;
        if ($wholesaleUnitName !== '' && $itemFactor > 1.0 && $item && (float) $item->cost_price > 0) {
            $expectedWholesaleCost = (float) $item->cost_price * $itemFactor;
            if ((float) $pi->cost_price >= ($expectedWholesaleCost * 0.5)) {
                $isLegacyWholesale = true;
            }
        }

        $factor = $isLegacyWholesale ? $itemFactor : 1.0;
        return [
            'unit_type' => $isLegacyWholesale ? 'wholesale' : 'base',
            'unit_name' => $isLegacyWholesale ? $wholesaleUnitName : $baseUnitName,
            'conversion_factor' => $factor,
            'base_quantity' => round(((float) $pi->quantity) * $factor, 3),
        ];
    }

    public function processPurchase(Request $request)
    {
        $request->validate([
            'store_id' => 'required|uuid',
            'supplier_id' => 'required|uuid',
            'payment_account_id' => 'nullable|uuid',
            'date' => 'required|date',
            'paid_amount' => 'numeric|min:0',
            'status' => 'required|in:pending,completed',
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|uuid',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.cost_price' => 'required|numeric|min:0',
            'items.*.sell_price' => 'nullable|numeric|min:0',
            'items.*.unit_type' => 'nullable|string|in:base,wholesale',
            'items.*.conversion_factor' => 'nullable|numeric|min:0.001',
        ]);

        try {
            DB::beginTransaction();

            $store = Store::find($request->store_id);
            $isGroceryStore = $store && $store->business_type === 'grocery_bulk';

            $totalAmount = 0;
            $itemsData = [];

            foreach ($request->items as $item) {
                $subtotal = $item['quantity'] * $item['cost_price'];
                $totalAmount += $subtotal;
                $itemsData[] = [
                    'id' => (string) Str::uuid(),
                    'item_id' => $item['item_id'],
                    'quantity' => $item['quantity'],
                    'cost_price' => $item['cost_price'],
                    'sell_price' => $item['sell_price'] ?? null,
                    'unit_type' => $isGroceryStore ? ($item['unit_type'] ?? 'base') : 'base',
                    'conversion_factor' => $isGroceryStore ? ($item['conversion_factor'] ?? null) : 1.0,
                    'subtotal' => $subtotal,
                ];
            }

            // Rapid duplicate check (2 seconds)
            $recentPurchase = Purchase::where('store_id', $request->store_id)
                ->where('supplier_id', $request->supplier_id)
                ->where('total_amount', $totalAmount)
                ->where('created_at', '>=', now()->subSeconds(2))
                ->first();
            if ($recentPurchase) {
                DB::rollBack();
                \Illuminate\Support\Facades\Log::info("PurchaseController: Deduplicated duplicate purchase for store {$request->store_id}");
                return response()->json(Purchase::with('items')->find($recentPurchase->id), 201);
            }

            $paidAmount = $request->paid_amount ?? 0;
            if ($paidAmount >= $totalAmount) {
                $status = 'Completed';
            } else {
                $status = 'Pending';
            }

            $purchase = Purchase::create([
                'store_id' => $request->store_id,
                'supplier_id' => $request->supplier_id,
                'user_id' => $request->user()->id,
                'reference_no' => 'PUR-' . strtoupper(Str::random(8)),
                'date' => $request->date,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'payment_account_id' => $request->payment_account_id,
                'status' => $status,
                'notes' => $request->notes,
            ]);

            $inventoryItemsById = Item::whereIn('id', array_column($itemsData, 'item_id'))->get()->keyBy('id');
            $hasExtendedColumns = Schema::hasColumn('purchase_items', 'base_quantity');

            foreach ($itemsData as $itemData) {
                $inventoryItem = $inventoryItemsById->get($itemData['item_id']);
                $unitType = $isGroceryStore ? ($itemData['unit_type'] ?? 'base') : 'base';
                $conversionFactor = 1.0;
                if ($isGroceryStore && $unitType === 'wholesale') {
                    $conversionFactor = max(0.001, (float) ($itemData['conversion_factor'] ?? $inventoryItem?->conversion_factor ?? 1.0));
                }
                $baseQty = round(((float) $itemData['quantity']) * $conversionFactor, $isGroceryStore ? 3 : 0);
                $unitName = $isGroceryStore
                    ? ($unitType === 'wholesale' && $inventoryItem?->wholesale_unit ? $inventoryItem->wholesale_unit : ($inventoryItem?->base_unit ?: 'KG'))
                    : 'Piece';

                $purchaseItemPayload = [
                    'id' => $itemData['id'],
                    'purchase_id' => $purchase->id,
                    'item_id' => $itemData['item_id'],
                    'quantity' => $itemData['quantity'],
                    'cost_price' => $itemData['cost_price'],
                    'subtotal' => $itemData['subtotal'],
                ];

                if ($hasExtendedColumns) {
                    $purchaseItemPayload['unit_type'] = $unitType;
                    $purchaseItemPayload['unit_name'] = $unitName;
                    $purchaseItemPayload['conversion_factor'] = $conversionFactor;
                    $purchaseItemPayload['base_quantity'] = $baseQty;
                    $purchaseItemPayload['returned_quantity'] = 0;
                    $purchaseItemPayload['returned_base_quantity'] = 0;
                }

                PurchaseItem::create($purchaseItemPayload);

                if ($request->status === 'completed' && $inventoryItem) {
                    $existingQty = (float) ($inventoryItem->quantity ?? 0);
                    $existingCost = (float) ($inventoryItem->cost_price ?? 0);
                    $newQty = $baseQty;
                    $newCost = $conversionFactor > 0
                        ? (((float) $itemData['cost_price']) / $conversionFactor)
                        : (float) $itemData['cost_price'];

                    $totalQty = $existingQty + $newQty;

                    if ($totalQty > 0) {
                        $weightedCost = (($existingQty * $existingCost) + ($newQty * $newCost)) / $totalQty;
                        $inventoryItem->cost_price = round($weightedCost, 2);
                    } else {
                        $inventoryItem->cost_price = round($newCost, 2);
                    }

                    if (isset($itemData['sell_price']) && is_numeric($itemData['sell_price']) && (float) $itemData['sell_price'] > 0) {
                        if ($unitType === 'wholesale') {
                            $inventoryItem->wholesale_price = (float) $itemData['sell_price'];
                        } else {
                            $inventoryItem->sell_price = (float) $itemData['sell_price'];
                            $inventoryItem->retail_price = (float) $itemData['sell_price'];
                        }
                    }

                    $inventoryItem->quantity = round($existingQty + $newQty, $isGroceryStore ? 3 : 0);
                    $inventoryItem->save();
                }
            }

            // Financial & Cash Flow Integration (Accounting Balance)
            if (($request->paid_amount ?? 0) > 0 && $request->payment_account_id) {
                $paymentAccount = \App\Models\PaymentAccount::find($request->payment_account_id);
                $accountName = $paymentAccount ? $paymentAccount->account_name : 'account';

                Expense::create([
                    'store_id' => $request->store_id,
                    'expense_type' => 'Purchase',
                    'amount' => $request->paid_amount,
                    'note' => 'Payment for Purchase ' . $purchase->reference_no,
                    'created_by' => $request->user()->id,
                    'employee_user_id' => $request->user()->id,
                    'employee_name' => $request->user()->full_name ?? $request->user()->name ?? 'Unknown',
                    'payment_account_id' => $request->payment_account_id,
                    'payment_method' => $accountName,
                ]);
            }

            DB::commit();

            return response()->json(Purchase::with('items')->find($purchase->id), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function paySupplierDebt(Request $request)
    {
        $request->validate([
            'store_id' => 'required',
            'supplier_id' => 'required',
            'amount' => 'required|numeric|min:0.01',
            'payment_account_id' => 'required',
            'purchase_ids' => 'nullable|array'
        ]);

        try {
            DB::beginTransaction();

            $amountToPay = $request->amount;
            $supplierId = $request->supplier_id;

            // Rapid duplicate check (2 seconds)
            $recentExpense = Expense::where('store_id', $request->store_id)
                ->where('supplier_id', $supplierId)
                ->where('amount', $amountToPay)
                ->where('expense_type', 'Supplier Payment')
                ->where('created_at', '>=', now()->subSeconds(2))
                ->first();
            if ($recentExpense) {
                DB::rollBack();
                \Illuminate\Support\Facades\Log::info("PurchaseController: Deduplicated duplicate supplier debt payment for supplier {$supplierId}");
                return response()->json(['success' => true]);
            }

            $query = Purchase::where('supplier_id', $supplierId)
                ->where('store_id', $request->store_id)
                ->where('status', 'Pending')
                ->whereRaw('total_amount > paid_amount');

            if (!empty($request->purchase_ids)) {
                $query->whereIn('id', $request->purchase_ids);
            }

            $unpaidPurchases = $query->orderBy('date', 'asc')->get();

            $remaining = $amountToPay;
            foreach ($unpaidPurchases as $purchase) {
                if ($remaining <= 0) break;
                
                $due = $purchase->total_amount - $purchase->paid_amount;
                if ($remaining >= $due) {
                    $purchase->paid_amount = $purchase->total_amount;
                    $purchase->status = 'Completed';
                    $remaining -= $due;
                } else {
                    $purchase->paid_amount += $remaining;
                    $purchase->status = 'Pending';
                    $remaining = 0;
                }
                $purchase->save();
            }

            // Record Expense
            $paymentAccount = \App\Models\PaymentAccount::find($request->payment_account_id);
            $accountName = $paymentAccount ? $paymentAccount->account_name : 'account';

            Expense::create([
                'store_id' => $request->store_id,
                'expense_type' => 'Supplier Payment',
                'amount' => $amountToPay,
                'note' => 'Payment for Supplier Debt (Ref: ' . ($request->reference ?? 'Manual') . ')',
                'created_by' => $request->user()->id,
                'employee_user_id' => $request->user()->id,
                'employee_name' => $request->user()->full_name ?? $request->user()->name ?? 'Unknown',
                'supplier_id' => $supplierId,
                'payment_account_id' => $request->payment_account_id,
                'payment_method' => $accountName,
            ]);

            DB::commit();
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function deletePurchase(Request $request, $id = null)
    {
        $purchaseId = $id ?? $request->input('purchase_id') ?? $request->input('id');
        if (!$purchaseId) {
            return response()->json(['error' => 'Purchase ID is required.'], 422);
        }

        $purchase = Purchase::with('items')->findOrFail($purchaseId);

        if (!$this->isUserAdminOrOwner($request, (string) $purchase->store_id)) {
            return response()->json([
                'error' => 'Forbidden: Only Store Owners and Admins are permitted to delete purchases.',
            ], 403);
        }

        $store = Store::find($purchase->store_id);
        $isGroceryStore = $store && $store->business_type === 'grocery_bulk';

        $purchaseItems = $purchase->items;
        $inventoryItemsById = $purchaseItems->isEmpty()
            ? collect()
            : Item::whereIn('id', $purchaseItems->pluck('item_id'))->get()->keyBy('id');

        // Pre-validate stock availability before mutating anything (prevent negative inventory)
        $reversals = [];
        foreach ($purchaseItems as $pi) {
            $inventoryItem = $inventoryItemsById->get($pi->item_id);
            if (!$inventoryItem) {
                continue;
            }

            $meta = $this->resolvePurchaseItemMeta($pi, $inventoryItem, $isGroceryStore);
            $baseQtyToReverse = max(0.0, (float) $meta['base_quantity']);
            if ($baseQtyToReverse <= 0) {
                continue;
            }

            $currentStock = (float) ($inventoryItem->quantity ?? 0);
            $baseUnitLabel = $isGroceryStore ? ($inventoryItem->base_unit ?: 'KG') : 'Piece';

            if (($currentStock + 0.0005) < $baseQtyToReverse) {
                return response()->json([
                    'error' => "Cannot delete purchase {$purchase->reference_no}: Stock for \"{$inventoryItem->name}\" has already been sold or depleted (Requires reversing {$baseQtyToReverse} {$baseUnitLabel}, but only {$currentStock} {$baseUnitLabel} in stock).",
                ], 422);
            }

            $reversals[] = [
                'inventory_item' => $inventoryItem,
                'base_qty_to_reverse' => $baseQtyToReverse,
            ];
        }

        try {
            DB::beginTransaction();

            // 1. Reverse inventory quantities
            foreach ($reversals as $rev) {
                /** @var Item $invItem */
                $invItem = $rev['inventory_item'];
                $newStock = max(0.0, (float) $invItem->quantity - (float) $rev['base_qty_to_reverse']);
                $invItem->quantity = round($newStock, $isGroceryStore ? 3 : 0);
                $invItem->save();
            }

            // 2. Reverse linked Expense records (Cash Flow / Payment Account adjustment)
            $userId = $request->user()?->id ?? auth()->id();
            $linkedExpenses = Expense::withoutGlobalScope(\App\Models\Scopes\StaffActivityScope::class)
                ->where('store_id', $purchase->store_id)
                ->where('note', 'like', '%' . $purchase->reference_no . '%')
                ->get();

            foreach ($linkedExpenses as $exp) {
                if ($exp->status !== 'reversed') {
                    $exp->update([
                        'status' => 'reversed',
                        'refund_reason' => "Purchase {$purchase->reference_no} deleted and reversed",
                        'refund_amount' => $exp->amount,
                        'refunded_at' => now(),
                        'refunded_by' => $userId,
                    ]);
                }
            }

            // 3. Delete purchase items and purchase record (removes supplier payable / credit liability)
            PurchaseItem::where('purchase_id', $purchase->id)->delete();
            $purchase->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Purchase {$purchase->reference_no} deleted and inventory/financial records reversed.",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to delete purchase: ' . $e->getMessage()], 500);
        }
    }

    public function returnPurchase(Request $request, $id = null)
    {
        $purchaseId = $id ?? $request->input('purchase_id') ?? $request->input('id');
        if (!$purchaseId) {
            return response()->json(['error' => 'Purchase ID is required.'], 422);
        }

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.purchase_item_id' => 'required|string',
            'items.*.return_quantity' => 'required|numeric|min:0.001',
            'items.*.return_unit_type' => 'nullable|string|in:base,wholesale',
            'reason' => 'nullable|string|max:500',
        ]);

        $purchase = Purchase::with('items')->findOrFail($purchaseId);

        if (!$this->isUserAdminOrOwner($request, (string) $purchase->store_id)) {
            return response()->json([
                'error' => 'Forbidden: Only Store Owners and Admins are permitted to process purchase returns.',
            ], 403);
        }

        $store = Store::find($purchase->store_id);
        $isGroceryStore = $store && $store->business_type === 'grocery_bulk';

        $purchaseItemsById = $purchase->items->keyBy('id');
        $inventoryItemsById = Item::whereIn('id', $purchase->items->pluck('item_id'))->get()->keyBy('id');
        $hasExtendedColumns = Schema::hasColumn('purchase_items', 'base_quantity');

        $plannedReturns = [];
        $totalReturnFinancialValue = 0.0;

        foreach ($request->items as $reqItem) {
            $returnQty = (float) ($reqItem['return_quantity'] ?? 0);
            if ($returnQty <= 0) {
                continue;
            }

            if (!$isGroceryStore) {
                $returnQty = round($returnQty, 0);
            }

            /** @var PurchaseItem|null $pi */
            $pi = $purchaseItemsById->get($reqItem['purchase_item_id']);
            if (!$pi) {
                return response()->json(['error' => 'Invalid purchase line item selected for return.'], 422);
            }

            /** @var Item|null $inventoryItem */
            $inventoryItem = $inventoryItemsById->get($pi->item_id);
            if (!$inventoryItem) {
                return response()->json(['error' => 'Associated inventory product not found.'], 422);
            }

            $meta = $this->resolvePurchaseItemMeta($pi, $inventoryItem, $isGroceryStore);
            $lineUnitType = $meta['unit_type'];
            $lineFactor = max(0.001, (float) $meta['conversion_factor']);
            $lineRemainingBaseQty = max(0.0, (float) $meta['base_quantity']);
            $itemWholesaleFactor = max(0.001, (float) ($inventoryItem->conversion_factor ?? 1.0));
            $baseUnitLabel = $isGroceryStore ? ($inventoryItem->base_unit ?: 'KG') : 'Piece';

            // Determine return unit type & base quantity to deduct
            $returnUnitType = $isGroceryStore
                ? ($reqItem['return_unit_type'] ?? $lineUnitType)
                : 'base';

            $returnFactor = ($isGroceryStore && $returnUnitType === 'wholesale' && !empty($inventoryItem->wholesale_unit))
                ? $itemWholesaleFactor
                : 1.0;

            $returnBaseQty = round($returnQty * $returnFactor, $isGroceryStore ? 3 : 0);

            if (($returnBaseQty - 0.0005) > $lineRemainingBaseQty) {
                return response()->json([
                    'error' => "Return quantity for \"{$inventoryItem->name}\" ({$returnBaseQty} {$baseUnitLabel}) exceeds the remaining purchased quantity ({$lineRemainingBaseQty} {$baseUnitLabel}).",
                ], 422);
            }

            $currentStock = (float) ($inventoryItem->quantity ?? 0);
            if (($currentStock + 0.0005) < $returnBaseQty) {
                return response()->json([
                    'error' => "Cannot return {$returnBaseQty} {$baseUnitLabel} of \"{$inventoryItem->name}\": Only {$currentStock} {$baseUnitLabel} currently in stock.",
                ], 422);
            }

            // Compute unit cost per base unit on this purchase line
            $baseUnitCost = $lineFactor > 0
                ? (((float) $pi->cost_price) / $lineFactor)
                : (float) $pi->cost_price;

            $lineReturnAmount = round($returnBaseQty * $baseUnitCost, 2);
            $lineQtyReductionInPurchaseUnit = $lineFactor > 0
                ? round($returnBaseQty / $lineFactor, $isGroceryStore ? 3 : 0)
                : $returnBaseQty;

            $totalReturnFinancialValue += $lineReturnAmount;

            $plannedReturns[] = [
                'purchase_item' => $pi,
                'inventory_item' => $inventoryItem,
                'return_base_qty' => $returnBaseQty,
                'line_qty_reduction' => $lineQtyReductionInPurchaseUnit,
                'line_return_amount' => $lineReturnAmount,
                'remaining_base_qty_before' => $lineRemainingBaseQty,
                'line_unit_type' => $lineUnitType,
                'line_unit_name' => $meta['unit_name'],
                'line_factor' => $lineFactor,
            ];
        }

        if (empty($plannedReturns)) {
            return response()->json(['error' => 'Please enter a valid return quantity for at least one item.'], 422);
        }

        try {
            DB::beginTransaction();

            foreach ($plannedReturns as $plan) {
                /** @var PurchaseItem $pi */
                $pi = $plan['purchase_item'];
                /** @var Item $invItem */
                $invItem = $plan['inventory_item'];

                // 1. Reduce inventory stock in base units
                $newStock = max(0.0, (float) $invItem->quantity - (float) $plan['return_base_qty']);
                $invItem->quantity = round($newStock, $isGroceryStore ? 3 : 0);
                $invItem->save();

                // 2. Update purchase line item quantities and subtotals
                $newLineQty = max(0.0, round((float) $pi->quantity - (float) $plan['line_qty_reduction'], $isGroceryStore ? 3 : 0));
                $newLineSubtotal = max(0.0, round((float) $pi->subtotal - (float) $plan['line_return_amount'], 2));
                $newBaseQty = max(0.0, round((float) $plan['remaining_base_qty_before'] - (float) $plan['return_base_qty'], $isGroceryStore ? 3 : 0));

                $piUpdates = [
                    'quantity' => $newLineQty,
                    'subtotal' => $newLineSubtotal,
                ];

                if ($hasExtendedColumns) {
                    $piUpdates['unit_type'] = $plan['line_unit_type'];
                    $piUpdates['unit_name'] = $plan['line_unit_name'];
                    $piUpdates['conversion_factor'] = $plan['line_factor'];
                    $piUpdates['base_quantity'] = $newBaseQty;
                    $piUpdates['returned_quantity'] = round(((float) ($pi->returned_quantity ?? 0)) + (float) $plan['line_qty_reduction'], $isGroceryStore ? 3 : 0);
                    $piUpdates['returned_base_quantity'] = round(((float) ($pi->returned_base_quantity ?? 0)) + (float) $plan['return_base_qty'], $isGroceryStore ? 3 : 0);
                }

                $pi->update($piUpdates);
            }

            // 3. Financial adjustment on Purchase & linked Expenses
            $newTotalAmount = max(0.0, round((float) $purchase->total_amount - $totalReturnFinancialValue, 2));
            $currentPaid = (float) $purchase->paid_amount;
            $refundedCashAmount = 0.0;

            if ($currentPaid > $newTotalAmount) {
                $refundedCashAmount = round($currentPaid - $newTotalAmount, 2);
                $currentPaid = $newTotalAmount;
            }

            $newStatus = $newTotalAmount <= 0
                ? 'Returned'
                : ($currentPaid >= $newTotalAmount ? 'Completed' : 'Pending');

            $reasonNote = trim((string) ($request->reason ?? ''));
            $returnSummaryNote = '[Returned ' . number_format($totalReturnFinancialValue, 2) . ($reasonNote ? ": {$reasonNote}" : '') . ']';
            $updatedNotes = trim(($purchase->notes ? $purchase->notes . ' ' : '') . $returnSummaryNote);

            $purchase->update([
                'total_amount' => $newTotalAmount,
                'paid_amount' => $currentPaid,
                'status' => $newStatus,
                'notes' => $updatedNotes,
            ]);

            if ($refundedCashAmount > 0) {
                $userId = $request->user()?->id ?? auth()->id();
                $linkedExpenses = Expense::withoutGlobalScope(\App\Models\Scopes\StaffActivityScope::class)
                    ->where('store_id', $purchase->store_id)
                    ->where('note', 'like', '%' . $purchase->reference_no . '%')
                    ->where('status', '!=', 'reversed')
                    ->orderBy('created_at', 'desc')
                    ->get();

                $remainingToRefund = $refundedCashAmount;
                foreach ($linkedExpenses as $exp) {
                    if ($remainingToRefund <= 0) {
                        break;
                    }
                    $expAmt = (float) $exp->amount;
                    if ($remainingToRefund >= ($expAmt - 0.005)) {
                        $exp->update([
                            'status' => 'reversed',
                            'refund_reason' => $reasonNote ?: "Purchase Return on {$purchase->reference_no}",
                            'refund_amount' => $expAmt,
                            'refunded_at' => now(),
                            'refunded_by' => $userId,
                        ]);
                        $remainingToRefund = round($remainingToRefund - $expAmt, 2);
                    } else {
                        $exp->update([
                            'amount' => round($expAmt - $remainingToRefund, 2),
                            'refund_amount' => round(((float) ($exp->refund_amount ?? 0)) + $remainingToRefund, 2),
                            'refund_reason' => $reasonNote ?: "Partial Purchase Return on {$purchase->reference_no}",
                            'note' => trim($exp->note . " (Adjusted -{$remainingToRefund} for Purchase Return)"),
                        ]);
                        $remainingToRefund = 0.0;
                    }
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Purchase return processed successfully.',
                'purchase' => Purchase::with('items')->find($purchase->id),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to process purchase return: ' . $e->getMessage()], 500);
        }
    }
}
