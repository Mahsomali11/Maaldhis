<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add comprehensive performance indexes to frequently queried columns across all core tables.
     */
    public function up(): void
    {
        $indexSpecs = [
            'stores' => [
                ['columns' => ['owner_user_id'], 'name' => 'idx_stores_owner_user_id'],
                ['columns' => ['status'], 'name' => 'idx_stores_status'],
                ['columns' => ['created_at'], 'name' => 'idx_stores_created_at'],
            ],
            'items' => [
                ['columns' => ['store_id'], 'name' => 'idx_items_store_id'],
                ['columns' => ['category_id'], 'name' => 'idx_items_category_id'],
                ['columns' => ['subcategory_id'], 'name' => 'idx_items_subcategory_id'],
                ['columns' => ['barcode'], 'name' => 'idx_items_barcode'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_items_store_created_at'],
            ],
            'categories' => [
                ['columns' => ['store_id'], 'name' => 'idx_categories_store_id'],
                ['columns' => ['parent_id'], 'name' => 'idx_categories_parent_id'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_categories_store_created_at'],
            ],
            'sales' => [
                ['columns' => ['store_id'], 'name' => 'idx_sales_store_id'],
                ['columns' => ['sold_at'], 'name' => 'idx_sales_sold_at'],
                ['columns' => ['created_at'], 'name' => 'idx_sales_created_at'],
                ['columns' => ['status'], 'name' => 'idx_sales_status'],
                ['columns' => ['receipt_no'], 'name' => 'idx_sales_receipt_no'],
                ['columns' => ['customer_id'], 'name' => 'idx_sales_customer_id'],
                ['columns' => ['staff_user_id'], 'name' => 'idx_sales_staff_user_id'],
                ['columns' => ['store_id', 'sold_at'], 'name' => 'idx_sales_store_sold_at'],
                ['columns' => ['store_id', 'status'], 'name' => 'idx_sales_store_status'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_sales_store_created_at'],
            ],
            'sale_items' => [
                ['columns' => ['sale_id'], 'name' => 'idx_sale_items_sale_id'],
                ['columns' => ['item_id'], 'name' => 'idx_sale_items_item_id'],
            ],
            'customers' => [
                ['columns' => ['store_id'], 'name' => 'idx_customers_store_id'],
                ['columns' => ['created_by'], 'name' => 'idx_customers_created_by'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_customers_store_created_at'],
            ],
            'customer_debts' => [
                ['columns' => ['store_id'], 'name' => 'idx_customer_debts_store_id'],
                ['columns' => ['customer_id'], 'name' => 'idx_customer_debts_customer_id'],
                ['columns' => ['sale_id'], 'name' => 'idx_customer_debts_sale_id'],
                ['columns' => ['status'], 'name' => 'idx_customer_debts_status'],
                ['columns' => ['created_at'], 'name' => 'idx_customer_debts_created_at'],
                ['columns' => ['store_id', 'status'], 'name' => 'idx_customer_debts_store_status'],
            ],
            'payments' => [
                ['columns' => ['store_id'], 'name' => 'idx_payments_store_id'],
                ['columns' => ['sale_id'], 'name' => 'idx_payments_sale_id'],
                ['columns' => ['customer_id'], 'name' => 'idx_payments_customer_id'],
                ['columns' => ['created_by'], 'name' => 'idx_payments_created_by'],
                ['columns' => ['reference'], 'name' => 'idx_payments_reference'],
                ['columns' => ['created_at'], 'name' => 'idx_payments_created_at'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_payments_store_created_at'],
            ],
            'expenses' => [
                ['columns' => ['store_id'], 'name' => 'idx_expenses_store_id'],
                ['columns' => ['created_by'], 'name' => 'idx_expenses_created_by'],
                ['columns' => ['supplier_id'], 'name' => 'idx_expenses_supplier_id'],
                ['columns' => ['status'], 'name' => 'idx_expenses_status'],
                ['columns' => ['created_at'], 'name' => 'idx_expenses_created_at'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_expenses_store_created_at'],
                ['columns' => ['store_id', 'status'], 'name' => 'idx_expenses_store_status'],
            ],
            'purchases' => [
                ['columns' => ['store_id'], 'name' => 'idx_purchases_store_id'],
                ['columns' => ['supplier_id'], 'name' => 'idx_purchases_supplier_id'],
                ['columns' => ['reference_no'], 'name' => 'idx_purchases_reference_no'],
                ['columns' => ['status'], 'name' => 'idx_purchases_status'],
                ['columns' => ['created_at'], 'name' => 'idx_purchases_created_at'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_purchases_store_created_at'],
                ['columns' => ['store_id', 'status'], 'name' => 'idx_purchases_store_status'],
            ],
            'purchase_items' => [
                ['columns' => ['purchase_id'], 'name' => 'idx_purchase_items_purchase_id'],
                ['columns' => ['item_id'], 'name' => 'idx_purchase_items_item_id'],
            ],
            'returns' => [
                ['columns' => ['store_id'], 'name' => 'idx_returns_store_id'],
                ['columns' => ['sale_id'], 'name' => 'idx_returns_sale_id'],
                ['columns' => ['processed_by'], 'name' => 'idx_returns_processed_by'],
                ['columns' => ['created_at'], 'name' => 'idx_returns_created_at'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_returns_store_created_at'],
            ],
            'return_items' => [
                ['columns' => ['return_id'], 'name' => 'idx_return_items_return_id'],
                ['columns' => ['sale_item_id'], 'name' => 'idx_return_items_sale_item_id'],
                ['columns' => ['item_id'], 'name' => 'idx_return_items_item_id'],
            ],
            'suppliers' => [
                ['columns' => ['store_id'], 'name' => 'idx_suppliers_store_id'],
                ['columns' => ['created_at'], 'name' => 'idx_suppliers_created_at'],
            ],
            'staff_accounts' => [
                ['columns' => ['store_id'], 'name' => 'idx_staff_accounts_store_id'],
                ['columns' => ['user_id'], 'name' => 'idx_staff_accounts_user_id'],
                ['columns' => ['email'], 'name' => 'idx_staff_accounts_email'],
                ['columns' => ['user_id', 'is_active'], 'name' => 'idx_staff_accounts_user_active'],
            ],
            'stock_transfers' => [
                ['columns' => ['source_store_id'], 'name' => 'idx_stock_transfers_source_store'],
                ['columns' => ['destination_store_id'], 'name' => 'idx_stock_transfers_dest_store'],
                ['columns' => ['item_id'], 'name' => 'idx_stock_transfers_item_id'],
                ['columns' => ['created_at'], 'name' => 'idx_stock_transfers_created_at'],
            ],
            'account_transfers' => [
                ['columns' => ['store_id'], 'name' => 'idx_account_transfers_store_id'],
                ['columns' => ['reference_number'], 'name' => 'idx_account_transfers_reference_number'],
                ['columns' => ['created_at'], 'name' => 'idx_account_transfers_created_at'],
                ['columns' => ['store_id', 'created_at'], 'name' => 'idx_account_transfers_store_created_at'],
            ],
            'payment_accounts' => [
                ['columns' => ['store_id'], 'name' => 'idx_payment_accounts_store_id'],
                ['columns' => ['store_id', 'is_active'], 'name' => 'idx_payment_accounts_store_active'],
            ],
            'licenses' => [
                ['columns' => ['store_id'], 'name' => 'idx_licenses_store_id'],
                ['columns' => ['status'], 'name' => 'idx_licenses_status'],
                ['columns' => ['store_id', 'status'], 'name' => 'idx_licenses_store_status'],
            ],
            'subscriptions' => [
                ['columns' => ['store_id'], 'name' => 'idx_subscriptions_store_id'],
                ['columns' => ['status'], 'name' => 'idx_subscriptions_status'],
            ],
            'admin_roles' => [
                ['columns' => ['user_id', 'is_active'], 'name' => 'idx_admin_roles_user_active'],
            ],
            'system_settings' => [
                ['columns' => ['setting_key'], 'name' => 'idx_system_settings_setting_key'],
            ],
        ];

        foreach ($indexSpecs as $tableName => $indexes) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            foreach ($indexes as $index) {
                $cols = $index['columns'];
                $indexName = $index['name'];

                // Ensure all columns exist on the table
                $allColsExist = true;
                foreach ($cols as $col) {
                    if (!Schema::hasColumn($tableName, $col)) {
                        $allColsExist = false;
                        break;
                    }
                }
                if (!$allColsExist) {
                    continue;
                }

                try {
                    Schema::table($tableName, function (Blueprint $table) use ($cols, $indexName) {
                        $table->index($cols, $indexName);
                    });
                } catch (\Throwable $e) {
                    // Index already exists on these columns or with this name — safe to ignore
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Indexes are non-destructive; safe no-op on down or drop by name if needed.
    }
};

