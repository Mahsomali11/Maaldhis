<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Item extends Model
{
    use HasUuids;
    protected $guarded = [];

    protected $casts = [
        'cost_price' => 'float',
        'sell_price' => 'float',
        'retail_price' => 'float',
        'wholesale_price' => 'float',
        'conversion_factor' => 'float',
        'quantity' => 'float',
        'low_stock_threshold' => 'float',
        'allow_decimal_qty' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function subCategory()
    {
        return $this->belongsTo(Category::class, 'sub_category_id');
    }
}
