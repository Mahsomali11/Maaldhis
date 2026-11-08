<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('dental_services')) {
            Schema::create('dental_services', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('store_id')->index();
                $table->string('name');
                $table->string('code')->nullable();
                $table->decimal('price', 12, 2)->default(0);
                $table->string('category')->nullable();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('dental_items')) {
            Schema::create('dental_items', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('store_id')->index();
                $table->string('name');
                $table->string('code')->nullable();
                $table->decimal('cost_price', 12, 2)->default(0);
                $table->decimal('retail_price', 12, 2)->default(0);
                $table->decimal('stock_quantity', 12, 2)->default(0);
                $table->decimal('reorder_level', 12, 2)->default(5);
                $table->string('category')->nullable();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dental_items');
        Schema::dropIfExists('dental_services');
    }
};

