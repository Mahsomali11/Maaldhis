<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class DentalChart extends Model
{
    use HasUuids;

    protected $table = 'dental_charts';
    protected $guarded = [];

    protected $casts = [
        'tooth_number' => 'integer',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    public function store()
    {
        return $this->belongsTo(Store::class, 'store_id');
    }
}

