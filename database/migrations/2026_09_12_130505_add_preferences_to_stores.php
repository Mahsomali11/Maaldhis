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
        Schema::table('stores', function (Blueprint $table) {
            $table->boolean('tax_enabled')->default(false);
            $table->integer('low_stock_threshold')->default(5);
            $table->string('receipt_footer')->nullable()->default('Thank you for shopping with us!');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn(['tax_enabled', 'low_stock_threshold', 'receipt_footer']);
        });
    }
};
