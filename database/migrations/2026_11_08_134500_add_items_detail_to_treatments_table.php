<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('treatments') && !Schema::hasColumn('treatments', 'items_detail')) {
            Schema::table('treatments', function (Blueprint $table) {
                $table->json('items_detail')->nullable()->after('notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('treatments') && Schema::hasColumn('treatments', 'items_detail')) {
            Schema::table('treatments', function (Blueprint $table) {
                $table->dropColumn('items_detail');
            });
        }
    }
};

