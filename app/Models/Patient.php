<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Patient extends Model
{
    use HasUuids;

    protected $table = 'patients';
    protected $guarded = [];

    protected $casts = [
        'age' => 'integer',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class, 'store_id');
    }

    public function invoices()
    {
        return $this->hasMany(Treatment::class, 'patient_id')->orderBy('created_at', 'desc');
    }

    public function treatments()
    {
        return $this->invoices();
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class, 'patient_id')->orderBy('appointment_date', 'desc');
    }

    public function dentalCharts()
    {
        return $this->hasMany(DentalChart::class, 'patient_id')->orderBy('tooth_number', 'asc');
    }

    public function dental_charts()
    {
        return $this->dentalCharts();
    }
}

