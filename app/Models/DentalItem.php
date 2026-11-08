<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class DentalItem extends Model
{
    use HasUuids;

    protected $table = 'dental_items';
    protected $guarded = [];

    protected $casts = [
        'cost_price' => 'float',
        'retail_price' => 'float',
        'stock_quantity' => 'float',
        'reorder_level' => 'float',
        'is_active' => 'boolean',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}

