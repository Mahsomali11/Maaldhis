<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class License extends Model
{
    use HasUuids;
    protected $guarded = [];

    protected $casts = [
        'features_enabled' => 'array',
        'is_active' => 'boolean',
        'start_date' => 'date:Y-m-d',
        'expiry_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    //

    public function plans() { return $this->belongsTo(Plan::class, 'plan_id'); }
}
