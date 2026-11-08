<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('patients')) {
            Schema::create('patients', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('store_id')->index();
                $table->string('patient_code')->nullable();
                $table->string('full_name');
                $table->string('phone')->nullable();
                $table->string('email')->nullable();
                $table->string('gender')->nullable();
                $table->integer('age')->nullable();
                $table->date('date_of_birth')->nullable();
                $table->string('address')->nullable();
                $table->string('blood_group')->nullable();
                $table->text('allergies')->nullable();
                $table->text('medical_history')->nullable();
                $table->text('dental_history')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('appointments')) {
            Schema::create('appointments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('store_id')->index();
                $table->uuid('patient_id')->nullable()->index();
                $table->string('patient_name');
                $table->string('patient_phone')->nullable();
                $table->string('doctor_name')->nullable();
                $table->date('appointment_date')->index();
                $table->string('appointment_time')->nullable();
                $table->integer('duration_minutes')->default(30);
                $table->string('reason')->nullable();
                $table->string('status')->default('scheduled');
                $table->text('notes')->nullable();
                $table->uuid('created_by')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('dental_charts')) {
            Schema::create('dental_charts', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('store_id')->index();
                $table->uuid('patient_id')->index();
                $table->integer('tooth_number');
                $table->string('tooth_name')->nullable();
                $table->string('condition_status')->default('healthy');
                $table->string('surface')->nullable();
                $table->text('diagnosis')->nullable();
                $table->text('treatment_plan')->nullable();
                $table->text('notes')->nullable();
                $table->uuid('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('treatments')) {
            Schema::create('treatments', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('store_id')->index();
                $table->uuid('patient_id')->nullable()->index();
                $table->string('patient_name');
                $table->uuid('appointment_id')->nullable();
                $table->string('invoice_no')->nullable()->index();
                $table->string('tooth_numbers')->nullable();
                $table->string('procedure_name');
                $table->string('category')->nullable();
                $table->text('diagnosis')->nullable();
                $table->text('prescription')->nullable();
                $table->string('doctor_name')->nullable();
                $table->decimal('cost', 12, 2)->default(0);
                $table->decimal('discount', 12, 2)->default(0);
                $table->decimal('total_amount', 12, 2)->default(0);
                $table->decimal('paid_amount', 12, 2)->default(0);
                $table->decimal('balance_amount', 12, 2)->default(0);
                $table->string('payment_status')->default('paid');
                $table->string('payment_method')->nullable();
                $table->uuid('payment_account_id')->nullable();
                $table->string('status')->default('completed');
                $table->text('notes')->nullable();
                $table->timestamp('performed_at')->nullable();
                $table->uuid('created_by')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('treatments');
        Schema::dropIfExists('dental_charts');
        Schema::dropIfExists('appointments');
        Schema::dropIfExists('patients');
    }
};

