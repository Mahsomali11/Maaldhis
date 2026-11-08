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
        if (!Schema::hasTable('doctors')) {
            Schema::create('doctors', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('store_id')->index();
                $table->uuid('staff_account_id')->nullable()->index();
                $table->uuid('user_id')->nullable()->index();
                $table->string('name');
                $table->string('specialization')->nullable()->default('General Dentist');
                $table->string('phone')->nullable();
                $table->string('email')->nullable();
                $table->string('working_hours')->nullable()->default('Mon - Sat: 09:00 AM - 05:00 PM');
                $table->boolean('is_active')->default(true);
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('appointments')) {
            Schema::table('appointments', function (Blueprint $table) {
                if (!Schema::hasColumn('appointments', 'doctor_id')) {
                    $table->uuid('doctor_id')->nullable()->after('patient_id')->index();
                }
                if (!Schema::hasColumn('appointments', 'service_id')) {
                    $table->uuid('service_id')->nullable()->after('doctor_id')->index();
                }
            });
        }

        // Backfill doctors from existing staff_accounts in dental clinic stores with dentist role
        try {
            $dentalStores = DB::table('stores')
                ->where('business_type', 'dental_clinic')
                ->pluck('id')
                ->all();

            if (!empty($dentalStores)) {
                $dentistStaff = DB::table('staff_accounts')
                    ->whereIn('store_id', $dentalStores)
                    ->whereIn('role', ['dentist', 'dental_doctor'])
                    ->get();

                foreach ($dentistStaff as $staff) {
                    $exists = DB::table('doctors')
                        ->where('store_id', $staff->store_id)
                        ->where(function ($q) use ($staff) {
                            $q->where('staff_account_id', $staff->id);
                            if (!empty($staff->email)) {
                                $q->orWhere('email', $staff->email);
                            }
                        })
                        ->exists();

                    if (!$exists) {
                        DB::table('doctors')->insert([
                            'id' => (string) Str::uuid(),
                            'store_id' => $staff->store_id,
                            'staff_account_id' => $staff->id,
                            'user_id' => $staff->user_id ?? null,
                            'name' => $staff->full_name,
                            'specialization' => 'General Dentist',
                            'phone' => $staff->phone ?? '',
                            'email' => $staff->email ?? '',
                            'working_hours' => 'Mon - Sat: 09:00 AM - 05:00 PM',
                            'is_active' => $staff->is_active ?? true,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            }
        } catch (\Throwable $e) {
            // Non-critical backfill
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('appointments')) {
            Schema::table('appointments', function (Blueprint $table) {
                if (Schema::hasColumn('appointments', 'service_id')) {
                    $table->dropColumn('service_id');
                }
                if (Schema::hasColumn('appointments', 'doctor_id')) {
                    $table->dropColumn('doctor_id');
                }
            });
        }

        Schema::dropIfExists('doctors');
    }
};

