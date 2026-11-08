<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class DentalService extends Model
{
    use HasUuids;

    protected $table = 'dental_services';
    protected $guarded = [];

    protected $casts = [
        'price' => 'float',
        'is_active' => 'boolean',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}

