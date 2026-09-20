<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Payment extends Model
{
    use HasUuids;
    protected $guarded = [];

    protected $casts = [
        'amount' => 'float',
    ];
}
