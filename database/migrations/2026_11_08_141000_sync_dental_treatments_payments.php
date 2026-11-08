<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('treatments') && Schema::hasTable('payments')) {
            $treatments = DB::table('treatments')
                ->where('paid_amount', '>', 0)
                ->get();

            foreach ($treatments as $t) {
                $targetAccountId = $t->payment_account_id;

                if (empty($targetAccountId)) {
                    // Find matching account in payment_accounts
                    $method = strtolower($t->payment_method ?? '');
                    if (str_contains($method, 'mobile') || str_contains($method, 'evc')) {
                        $targetAccountId = DB::table('payment_accounts')
                            ->where('store_id', $t->store_id)
                            ->where(function ($q) {
                                $q->where('account_type', 'Mobile Money')
                                  ->orWhere('account_name', 'like', '%EVC%')
                                  ->orWhere('account_name', 'like', '%Mobile%');
                            })
                            ->value('id');
                    }

                    if (empty($targetAccountId)) {
                        $targetAccountId = DB::table('payment_accounts')
                            ->where('store_id', $t->store_id)
                            ->where('account_type', 'Cash')
                            ->value('id');
                    }

                    if (empty($targetAccountId)) {
                        $targetAccountId = DB::table('payment_accounts')
                            ->where('store_id', $t->store_id)
                            ->value('id');
                    }

                    if ($targetAccountId) {
                        DB::table('treatments')
                            ->where('id', $t->id)
                            ->update(['payment_account_id' => $targetAccountId]);
                    }
                }

                // Check if a payment record already exists for this invoice
                $existingPayment = DB::table('payments')
                    ->where('reference', $t->invoice_no)
                    ->first();

                if (!$existingPayment && !empty($t->invoice_no)) {
                    $userId = $t->created_by;
                    if (empty($userId) || !DB::table('users')->where('id', $userId)->exists()) {
                        $userId = DB::table('users')->value('id');
                    }

                    DB::table('payments')->insert([
                        'id' => (string) Str::uuid(),
                        'store_id' => $t->store_id,
                        'sale_id' => null,
                        'customer_id' => null,
                        'supplier_id' => null,
                        'payment_type' => 'dental_invoice',
                        'direction' => 'in',
                        'method' => strtolower($t->payment_method ?? 'cash'),
                        'amount' => $t->paid_amount,
                        'reference' => $t->invoice_no,
                        'created_by' => $userId,
                        'payment_account_id' => $targetAccountId,
                        'created_at' => $t->performed_at ?? $t->created_at ?? now(),
                        'updated_at' => $t->updated_at ?? now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // No destructive down
    }
};

