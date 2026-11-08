<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Patient;
use App\Models\Treatment;
use App\Models\Appointment;
use App\Models\DentalChart;
use App\Models\Payment;
use App\Models\Store;

class PatientController extends Controller
{
    /**
     * Render the dedicated full-screen Patient Details Inertia view.
     */
    public function showPage(Request $request, string $id)
    {
        $patient = $this->loadPatientWithRelations($id);

        return Inertia::render('dental/PatientDetailsPage', [
            'patientId' => $id,
            'initialPatient' => $patient,
        ]);
    }

    /**
     * API endpoint to fetch patient details with eager-loaded relationships in real-time.
     */
    public function show(Request $request, string $id)
    {
        $patient = $this->loadPatientWithRelations($id);

        if (!$patient) {
            return response()->json(['error' => 'Patient not found'], 404);
        }

        return response()->json($patient);
    }

    /**
     * Update patient profile information.
     */
    public function update(Request $request, string $id)
    {
        $patient = Patient::findOrFail($id);

        $validated = $request->validate([
            'full_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'gender' => 'nullable|string|max:20',
            'age' => 'nullable|integer|min:0|max:130',
            'date_of_birth' => 'nullable|date',
            'blood_group' => 'nullable|string|max:10',
            'address' => 'nullable|string|max:255',
            'allergies' => 'nullable|string',
            'medical_history' => 'nullable|string',
            'dental_history' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $patient->update($validated);

        $fresh = $this->loadPatientWithRelations($id);

        return response()->json([
            'message' => 'Patient profile updated successfully',
            'patient' => $fresh,
        ]);
    }

    /**
     * Helper to load patient with all eager loaded relations.
     */
    protected function loadPatientWithRelations(string $id): ?Patient
    {
        $patient = Patient::with([
            'invoices' => function ($q) {
                $q->orderBy('created_at', 'desc');
            },
            'appointments' => function ($q) {
                $q->with('doctor')->orderBy('appointment_date', 'desc');
            },
            'dentalCharts' => function ($q) {
                $q->orderBy('tooth_number', 'asc');
            },
        ])->find($id);

        if (!$patient) {
            return null;
        }

        // Also fetch payments linked to this patient or their invoice numbers
        $invoiceNumbers = $patient->invoices->pluck('invoice_no')->filter()->values()->all();

        $payments = Payment::where('store_id', $patient->store_id)
            ->where(function ($q) use ($patient, $invoiceNumbers) {
                $q->where('customer_id', $patient->id);
                if (!empty($invoiceNumbers)) {
                    $q->orWhereIn('reference', $invoiceNumbers);
                }
            })
            ->orderBy('created_at', 'desc')
            ->get();

        $patient->setRelation('payments', $payments);

        return $patient;
    }
}

