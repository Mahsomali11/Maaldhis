<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\Doctor;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\Store;
use App\Support\PerformanceCache;

class DoctorController extends Controller
{
    /**
     * List all doctors for the given store.
     */
    public function index(Request $request)
    {
        $storeId = $request->query('store_id') ?? $request->input('store_id');
        if (!$storeId) {
            return response()->json(['error' => 'store_id is required'], 400);
        }

        $query = Doctor::where('store_id', $storeId)
            ->orderBy('name', 'asc');

        if ($request->has('active_only') && $request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json($query->get());
    }

    /**
     * Create a new doctor profile and automatically provision a staff login
     * with the role set to 'dentist' (Dental Doctor / Dentist).
     */
    public function store(Request $request)
    {
        $request->validate([
            'store_id' => 'required',
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'phone' => 'nullable|string|max:50',
            'specialization' => 'nullable|string|max:255',
            'working_hours' => 'nullable|string|max:255',
            'password' => 'nullable|string|min:6',
            'notes' => 'nullable|string',
        ]);

        $store = Store::findOrFail($request->store_id);

        return DB::transaction(function () use ($request, $store) {
            $email = strtolower(trim($request->email));
            $name = trim($request->name);
            $phone = trim($request->phone ?? '');
            $specialization = trim($request->specialization ?? 'General Dentist');
            $workingHours = trim($request->working_hours ?? 'Mon - Sat: 09:00 AM - 05:00 PM');
            $password = $request->password ? trim($request->password) : 'Doctor@123';

            // 1. Find or create the User record
            $user = User::where('email', $email)->first();
            if (!$user) {
                $user = User::create([
                    'id' => (string) Str::uuid(),
                    'email' => $email,
                    'password' => Hash::make($password),
                    'name' => $name,
                    'full_name' => $name,
                    'phone' => $phone,
                ]);
            } else {
                if ($request->filled('password')) {
                    $user->password = Hash::make($password);
                }
                if (empty($user->full_name)) {
                    $user->full_name = $name;
                }
                if (empty($user->name)) {
                    $user->name = $name;
                }
                $user->save();
            }

            // 2. Find or create the StaffAccount record
            $staff = StaffAccount::where('store_id', $store->id)
                ->where(function ($q) use ($email, $user) {
                    $q->where('email', $email);
                    if ($user) {
                        $q->orWhere('user_id', $user->id);
                    }
                })
                ->first();

            if (!$staff) {
                $staff = StaffAccount::create([
                    'id' => (string) Str::uuid(),
                    'user_id' => $user->id,
                    'store_id' => $store->id,
                    'full_name' => $name,
                    'email' => $email,
                    'phone' => $phone,
                    'role' => 'dentist',
                    'is_active' => true,
                ]);
            } else {
                $staff->update([
                    'user_id' => $user->id,
                    'full_name' => $name,
                    'phone' => $phone,
                    'role' => 'dentist',
                    'is_active' => true,
                ]);
            }

            // 3. Find or create the Doctor record
            $doctor = Doctor::where('store_id', $store->id)
                ->where(function ($q) use ($staff, $email) {
                    $q->where('staff_account_id', $staff->id);
                    if ($email) {
                        $q->orWhere('email', $email);
                    }
                })
                ->first();

            if (!$doctor) {
                $doctor = Doctor::create([
                    'id' => (string) Str::uuid(),
                    'store_id' => $store->id,
                    'staff_account_id' => $staff->id,
                    'user_id' => $user->id,
                    'name' => $name,
                    'specialization' => $specialization ?: 'General Dentist',
                    'phone' => $phone,
                    'email' => $email,
                    'working_hours' => $workingHours ?: 'Mon - Sat: 09:00 AM - 05:00 PM',
                    'notes' => $request->notes ?? null,
                    'is_active' => true,
                ]);
            } else {
                $doctor->update([
                    'staff_account_id' => $staff->id,
                    'user_id' => $user->id,
                    'name' => $name,
                    'specialization' => $specialization ?: $doctor->specialization,
                    'phone' => $phone,
                    'email' => $email,
                    'working_hours' => $workingHours ?: $doctor->working_hours,
                    'notes' => $request->notes ?? $doctor->notes,
                    'is_active' => true,
                ]);
            }

            PerformanceCache::forgetUserAccessContext($user->id);

            return response()->json([
                'doctor' => $doctor,
                'staff' => $staff,
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                    'name' => $user->full_name,
                ],
                'initial_password' => $password,
            ], 201);
        });
    }

    /**
     * Update doctor profile and synchronize with staff_accounts and users.
     */
    public function update(Request $request, $id)
    {
        $doctor = Doctor::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email',
            'phone' => 'nullable|string|max:50',
            'specialization' => 'nullable|string|max:255',
            'working_hours' => 'nullable|string|max:255',
            'password' => 'nullable|string|min:6',
            'is_active' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request, $doctor) {
            $name = $request->filled('name') ? trim($request->name) : $doctor->name;
            $email = $request->filled('email') ? strtolower(trim($request->email)) : $doctor->email;
            $phone = $request->has('phone') ? trim($request->phone ?? '') : $doctor->phone;
            $specialization = $request->has('specialization') ? trim($request->specialization ?? '') : $doctor->specialization;
            $workingHours = $request->has('working_hours') ? trim($request->working_hours ?? '') : $doctor->working_hours;
            $isActive = $request->has('is_active') ? $request->boolean('is_active') : $doctor->is_active;

            $doctor->update([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'specialization' => $specialization,
                'working_hours' => $workingHours,
                'notes' => $request->has('notes') ? $request->notes : $doctor->notes,
                'is_active' => $isActive,
            ]);

            // Update linked staff account
            if ($doctor->staff_account_id) {
                $staff = StaffAccount::find($doctor->staff_account_id);
                if ($staff) {
                    $staff->update([
                        'full_name' => $name,
                        'email' => $email,
                        'phone' => $phone,
                        'is_active' => $isActive,
                    ]);
                }
            }

            // Update user if password was provided or email changed
            if ($doctor->user_id) {
                $user = User::find($doctor->user_id);
                if ($user) {
                    if ($request->filled('password')) {
                        $user->password = Hash::make(trim($request->password));
                    }
                    $user->name = $name;
                    $user->full_name = $name;
                    $user->email = $email;
                    $user->phone = $phone;
                    $user->save();

                    PerformanceCache::forgetUserAccessContext($user->id);
                }
            }

            return response()->json($doctor);
        });
    }

    /**
     * Delete or deactivate doctor profile safely.
     */
    public function destroy($id)
    {
        $doctor = Doctor::findOrFail($id);

        return DB::transaction(function () use ($doctor) {
            // Check if doctor has appointments
            $hasAppointments = DB::table('appointments')->where('doctor_id', $doctor->id)->exists();

            if ($doctor->staff_account_id) {
                $staff = StaffAccount::find($doctor->staff_account_id);
                if ($staff) {
                    if ($hasAppointments) {
                        $staff->update(['is_active' => false]);
                    } else {
                        $staff->delete();
                    }
                }
            }

            if ($hasAppointments) {
                $doctor->update(['is_active' => false]);
                return response()->json(['message' => 'Doctor has existing appointments and was marked as inactive.']);
            }

            $doctor->delete();
            return response()->json(['message' => 'Doctor deleted successfully.']);
        });
    }
}

