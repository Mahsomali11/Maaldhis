<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Doctor extends Model
{
    use HasUuids;

    protected $table = 'doctors';
    protected $guarded = [];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function staffAccount()
    {
        return $this->belongsTo(StaffAccount::class, 'staff_account_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function store()
    {
        return $this->belongsTo(Store::class, 'store_id');
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class, 'doctor_id');
    }
}

