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
            $table->string('logo_url')->nullable();
            $table->boolean('show_logo_on_receipt')->default(false);
            $table->string('receipt_thank_you_message')->nullable();
            $table->string('country')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn([
                'logo_url',
                'show_logo_on_receipt',
                'receipt_thank_you_message',
                'country'
            ]);
        });
    }
};
