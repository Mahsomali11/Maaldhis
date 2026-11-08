<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Treatment extends Model
{
    use HasUuids;

    protected $table = 'treatments';
    protected $guarded = [];

    protected $casts = [
        'cost' => 'float',
        'discount' => 'float',
        'total_amount' => 'float',
        'paid_amount' => 'float',
        'balance_amount' => 'float',
        'items_detail' => 'array',
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

