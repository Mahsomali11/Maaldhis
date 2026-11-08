<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required'
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'error' => 'invalid_credentials',
                'error_description' => 'Invalid login credentials'
            ], 400);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        $access = \App\Support\PerformanceCache::getUserAccessContext((string) $user->id, $user->email);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'user' => array_merge($user->toArray(), [
                'role' => $access['role'],
                'admin_role' => $access['admin_role'],
                'is_admin' => (bool) ($access['is_admin'] ?? false),
                'is_super_admin' => (bool) ($access['is_admin'] ?? false),
                'assigned_store_id' => $access['assigned_store_id'],
            ])
        ]);
    }

    public function signup(Request $request)
    {
        $request->validate([
            'email' => 'required|email|unique:users',
            'password' => 'required|min:6',
        ]);

        $data = $request->all();
        $options = $data['options']['data'] ?? [];

        $user = User::create([
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'name' => $options['full_name'] ?? '',
            'full_name' => $options['full_name'] ?? '',
            'phone' => $options['phone'] ?? '',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'user' => array_merge($user->toArray(), [
                'role' => 'owner', // signups are always owners initially
                'assigned_store_id' => null
            ])
        ]);
    }

    public function signupWithStore(Request $request)
    {
        $request->validate([
            'email' => 'required|email|unique:users',
            'password' => 'required|min:6',
            'storeName' => 'required',
        ]);

        $user = User::create([
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'name' => $request->fullName ?? '',
            'full_name' => $request->fullName ?? '',
            'phone' => $request->phone ?? '',
        ]);

        $rawBusinessType = $request->input('businessType', $request->input('business_type', 'standard_retail'));
        $businessType = in_array($rawBusinessType, ['standard_retail', 'grocery_bulk', 'dental_clinic'], true)
            ? $rawBusinessType
            : 'standard_retail';

        $store = \App\Models\Store::create([
            'owner_user_id' => $user->id,
            'store_name' => $request->storeName,
            'phone' => $request->storePhone ?? '',
            'location' => $request->storeLocation ?? '',
            'currency' => $request->currency ?? 'KSh',
            'business_type' => $businessType,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'user' => array_merge($user->toArray(), [
                'role' => 'owner',
                'assigned_store_id' => null
            ]),
            'store' => $store
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out'], 200);
    }

    public function createStaff(Request $request)
    {
        $request->validate([
            'email' => 'required|email|unique:users',
            'password' => 'required|min:6',
            'full_name' => 'required',
            'store_id' => 'required',
            'role' => 'required',
        ]);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($request) {
            // Create the user
            $user = User::create([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'name' => $request->full_name,
                'full_name' => $request->full_name,
                'phone' => $request->phone ?? '',
            ]);

            // Create the staff account
            $staff = \App\Models\StaffAccount::create([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'user_id' => $user->id,
                'store_id' => $request->store_id,
                'full_name' => $request->full_name,
                'email' => $request->email,
                'phone' => $request->phone ?? '',
                'role' => $request->role,
                'is_active' => true,
            ]);

            // If the store is a dental clinic and staff role is dentist, automatically create Doctor profile
            $store = \App\Models\Store::find($request->store_id);
            if ($store && $store->business_type === 'dental_clinic' && in_array($staff->role, ['dentist', 'dental_doctor'], true)) {
                \App\Models\Doctor::firstOrCreate(
                    ['store_id' => $store->id, 'email' => $staff->email],
                    [
                        'id' => (string) \Illuminate\Support\Str::uuid(),
                        'staff_account_id' => $staff->id,
                        'user_id' => $user->id,
                        'name' => $staff->full_name,
                        'specialization' => 'General Dentist',
                        'phone' => $staff->phone ?? '',
                        'working_hours' => 'Mon - Sat: 09:00 AM - 05:00 PM',
                        'is_active' => true,
                    ]
                );
            }

            return response()->json(['user' => $user, 'staff' => $staff], 201);
        });
    }

    public function updateStaffPassword(Request $request)
    {
        $request->validate([
            'staff_id' => 'required',
            'password' => 'required|min:6',
        ]);

        $staff = \App\Models\StaffAccount::find($request->staff_id);
        if (!$staff) return response()->json(['message' => 'Staff not found'], 404);

        $authUser = $request->user() ?? auth()->user();
        if ($authUser) {
            $isSelf = ($staff->user_id && (string) $staff->user_id === (string) $authUser->id)
                || ($staff->email && strtolower(trim($staff->email)) === strtolower(trim((string) $authUser->email)));
            if ($isSelf) {
                return response()->json([
                    'error' => 'Forbidden: You cannot modify your own staff account from Staff Management.',
                    'message' => 'Forbidden: You cannot modify your own staff account from Staff Management.',
                ], 403);
            }
        }

        $user = User::where('email', $staff->email)->orWhere('id', $staff->user_id)->first();
        
        if ($user) {
            $user->password = Hash::make($request->password);
            $user->save();
            return response()->json(['message' => 'Password updated'], 200);
        }

        return response()->json(['message' => 'User not found'], 404);
    }
}
