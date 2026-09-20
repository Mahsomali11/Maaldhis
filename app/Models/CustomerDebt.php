<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class CustomerDebt extends Model
{
    use HasUuids;
    protected $guarded = [];

    protected $casts = [
        'original_amount' => 'float',
        'balance_amount' => 'float',
    ];
}
