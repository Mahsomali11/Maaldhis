<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('stores')) {
            Schema::table('stores', function (Blueprint $table) {
                if (!Schema::hasColumn('stores', 'business_type')) {
                    $table->string('business_type')->default('standard_retail');
                }
            });
        }

        if (Schema::hasTable('items')) {
            Schema::table('items', function (Blueprint $table) {
                if (!Schema::hasColumn('items', 'allow_decimal_qty')) {
                    $table->boolean('allow_decimal_qty')->default(false);
                }
                if (!Schema::hasColumn('items', 'base_unit')) {
                    $table->string('base_unit')->nullable()->default('Piece');
                }
                if (!Schema::hasColumn('items', 'wholesale_unit')) {
                    $table->string('wholesale_unit')->nullable();
                }
                if (!Schema::hasColumn('items', 'conversion_factor')) {
                    $table->decimal('conversion_factor', 12, 3)->default(1.000);
                }
                if (!Schema::hasColumn('items', 'wholesale_price')) {
                    $table->decimal('wholesale_price', 12, 2)->nullable();
                }
                if (!Schema::hasColumn('items', 'retail_price')) {
                    $table->decimal('retail_price', 12, 2)->nullable();
                }
            });

            try {
                DB::statement('ALTER TABLE `items` MODIFY COLUMN `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 0.000');
                DB::statement('ALTER TABLE `items` MODIFY COLUMN `low_stock_threshold` DECIMAL(12, 3) NOT NULL DEFAULT 5.000');
                DB::statement('UPDATE `items` SET `retail_price` = `sell_price` WHERE `retail_price` IS NULL');
            } catch (\Throwable $e) {
            }
        }

        if (Schema::hasTable('sale_items')) {
            try {
                DB::statement('ALTER TABLE `sale_items` MODIFY COLUMN `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1.000');
            } catch (\Throwable $e) {
            }
        }

        if (Schema::hasTable('return_items')) {
            try {
                DB::statement('ALTER TABLE `return_items` MODIFY COLUMN `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1.000');
            } catch (\Throwable $e) {
            }
        }

        if (Schema::hasTable('purchase_items')) {
            try {
                DB::statement('ALTER TABLE `purchase_items` MODIFY COLUMN `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1.000');
            } catch (\Throwable $e) {
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('stores')) {
            Schema::table('stores', function (Blueprint $table) {
                if (Schema::hasColumn('stores', 'business_type')) {
                    $table->dropColumn('business_type');
                }
            });
        }

        if (Schema::hasTable('items')) {
            Schema::table('items', function (Blueprint $table) {
                $cols = [];
                foreach (['allow_decimal_qty', 'base_unit', 'wholesale_unit', 'conversion_factor', 'wholesale_price', 'retail_price'] as $c) {
                    if (Schema::hasColumn('items', $c)) {
                        $cols[] = $c;
                    }
                }
                if (!empty($cols)) {
                    $table->dropColumn($cols);
                }
            });
        }
    }
};

