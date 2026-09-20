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
        // Fix stores
        Schema::table('stores', function (Blueprint $table) {
            $table->string('store_code')->nullable()->change();
            $table->string('location')->nullable()->change();
            $table->string('phone')->nullable()->change();
        });

        // Fix suppliers
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('supplier_code')->nullable()->change();
            $table->string('phone')->nullable()->change();
        });

        // Fix customers
        Schema::table('customers', function (Blueprint $table) {
            $table->string('customer_code')->nullable()->change();
            $table->string('phone')->nullable()->change();
        });

        // Fix staff_accounts
        Schema::table('staff_accounts', function (Blueprint $table) {
            $table->string('phone')->nullable()->change();
        });
    }

    public function down(): void
    {
        // No need to revert - nullable is safer
    }
};
