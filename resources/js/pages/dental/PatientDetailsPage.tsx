import { useState, useEffect, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import { cacheRecord, cacheRecords } from '@/lib/offline/indexedDb';
import type { Patient, DentalTreatment, DentalChartEntry, Appointment, TreatmentLineItem } from '@/types';
import { toast } from 'sonner';
import {
  User, Phone, Mail, MapPin, Calendar, HeartPulse, Stethoscope,
  Printer, Edit2, AlertTriangle, CheckCircle2, Clock, DollarSign,
  ArrowLeft, Plus, Receipt, ShieldAlert, FileText, Check, X,
  CreditCard, ChevronRight, Hash, Layers
} from 'lucide-react';

interface Props {
  patientId: string;
  initialPatient?: Patient | null;
}

// Tooth definition structure for Odontogram
interface ToothDef {
  num: number;
  fdi: number;
  name: string;
  arch: 'upper' | 'lower';
  quadrant: 'UR' | 'UL' | 'LL' | 'LR';
}

const TOOTH_DEFINITIONS: ToothDef[] = [
  // Upper Right (1 to 8)
  { num: 1, fdi: 18, name: 'Upper Right 3rd Molar (Wisdom)', arch: 'upper', quadrant: 'UR' },
  { num: 2, fdi: 17, name: 'Upper Right 2nd Molar', arch: 'upper', quadrant: 'UR' },
  { num: 3, fdi: 16, name: 'Upper Right 1st Molar', arch: 'upper', quadrant: 'UR' },
  { num: 4, fdi: 15, name: 'Upper Right 2nd Premolar', arch: 'upper', quadrant: 'UR' },
  { num: 5, fdi: 14, name: 'Upper Right 1st Premolar', arch: 'upper', quadrant: 'UR' },
  { num: 6, fdi: 13, name: 'Upper Right Canine', arch: 'upper', quadrant: 'UR' },
  { num: 7, fdi: 12, name: 'Upper Right Lateral Incisor', arch: 'upper', quadrant: 'UR' },
  { num: 8, fdi: 11, name: 'Upper Right Central Incisor', arch: 'upper', quadrant: 'UR' },

  // Upper Left (9 to 16)
  { num: 9, fdi: 21, name: 'Upper Left Central Incisor', arch: 'upper', quadrant: 'UL' },
  { num: 10, fdi: 22, name: 'Upper Left Lateral Incisor', arch: 'upper', quadrant: 'UL' },
  { num: 11, fdi: 23, name: 'Upper Left Canine', arch: 'upper', quadrant: 'UL' },
  { num: 12, fdi: 24, name: 'Upper Left 1st Premolar', arch: 'upper', quadrant: 'UL' },
  { num: 13, fdi: 25, name: 'Upper Left 2nd Premolar', arch: 'upper', quadrant: 'UL' },
  { num: 14, fdi: 26, name: 'Upper Left 1st Molar', arch: 'upper', quadrant: 'UL' },
  { num: 15, fdi: 27, name: 'Upper Left 2nd Molar', arch: 'upper', quadrant: 'UL' },
  { num: 16, fdi: 28, name: 'Upper Left 3rd Molar (Wisdom)', arch: 'upper', quadrant: 'UL' },

  // Lower Left (17 to 24)
  { num: 17, fdi: 38, name: 'Lower Left 3rd Molar (Wisdom)', arch: 'lower', quadrant: 'LL' },
  { num: 18, fdi: 37, name: 'Lower Left 2nd Molar', arch: 'lower', quadrant: 'LL' },
  { num: 19, fdi: 36, name: 'Lower Left 1st Molar', arch: 'lower', quadrant: 'LL' },
  { num: 20, fdi: 35, name: 'Lower Left 2nd Premolar', arch: 'lower', quadrant: 'LL' },
  { num: 21, fdi: 34, name: 'Lower Left 1st Premolar', arch: 'lower', quadrant: 'LL' },
  { num: 22, fdi: 33, name: 'Lower Left Canine', arch: 'lower', quadrant: 'LL' },
  { num: 23, fdi: 32, name: 'Lower Left Lateral Incisor', arch: 'lower', quadrant: 'LL' },
  { num: 24, fdi: 31, name: 'Lower Left Central Incisor', arch: 'lower', quadrant: 'LL' },

  // Lower Right (25 to 32)
  { num: 25, fdi: 41, name: 'Lower Right Central Incisor', arch: 'lower', quadrant: 'LR' },
  { num: 26, fdi: 42, name: 'Lower Right Lateral Incisor', arch: 'lower', quadrant: 'LR' },
  { num: 27, fdi: 43, name: 'Lower Right Canine', arch: 'lower', quadrant: 'LR' },
  { num: 28, fdi: 44, name: 'Lower Right 1st Premolar', arch: 'lower', quadrant: 'LR' },
  { num: 29, fdi: 45, name: 'Lower Right 2nd Premolar', arch: 'lower', quadrant: 'LR' },
  { num: 30, fdi: 46, name: 'Lower Right 1st Molar', arch: 'lower', quadrant: 'LR' },
  { num: 31, fdi: 47, name: 'Lower Right 2nd Molar', arch: 'lower', quadrant: 'LR' },
  { num: 32, fdi: 48, name: 'Lower Right 3rd Molar (Wisdom)', arch: 'lower', quadrant: 'LR' },
];

const CONDITION_STYLES: Record<DentalChartEntry['condition_status'], { label: string; bg: string; text: string; border: string }> = {
  healthy: { label: 'Healthy', bg: 'bg-emerald-500/15', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  caries: { label: 'Caries / Decay', bg: 'bg-rose-500/20', text: 'text-rose-500', border: 'border-rose-500/40' },
  filled: { label: 'Filled', bg: 'bg-blue-500/20', text: 'text-blue-500', border: 'border-blue-500/40' },
  crown: { label: 'Crown / Cap', bg: 'bg-amber-500/20', text: 'text-amber-500', border: 'border-amber-500/40' },
  root_canal: { label: 'Root Canal (RCT)', bg: 'bg-purple-500/20', text: 'text-purple-500', border: 'border-purple-500/40' },
  extraction_needed: { label: 'Extraction Needed', bg: 'bg-orange-500/20', text: 'text-orange-500', border: 'border-orange-500/40' },
  missing: { label: 'Missing', bg: 'bg-muted/80', text: 'text-muted-foreground', border: 'border-border border-dashed' },
  implant: { label: 'Implant', bg: 'bg-cyan-500/20', text: 'text-cyan-500', border: 'border-cyan-500/40' },
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientDetailsPage({ patientId, initialPatient }: Props) {
  const { currentStore, formatCurrency, user } = useApp();
  const navigate = (url: string) => router.visit(url);

  const isDentalClinic = currentStore?.business_type === 'dental_clinic';

  const [patient, setPatient] = useState<Patient | null>(initialPatient || null);
  const [loading, setLoading] = useState(!initialPatient);
  const [activeTab, setActiveTab] = useState<'invoices' | 'charting' | 'appointments' | 'history'>('invoices');

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState<DentalTreatment | null>(null);
  const [showCollectModal, setShowCollectModal] = useState<DentalTreatment | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const [collectAccountId, setCollectAccountId] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);

  // Odontogram state
  const [chartEntries, setChartEntries] = useState<Record<number, DentalChartEntry>>({});
  const [activeTooth, setActiveTooth] = useState<ToothDef | null>(null);
  const [savingTooth, setSavingTooth] = useState(false);
  const [toothForm, setToothForm] = useState({
    condition_status: 'healthy' as DentalChartEntry['condition_status'],
    surface: '',
    diagnosis: '',
    treatment_plan: '',
    notes: '',
  });

  // Edit Patient Form State
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    gender: 'Male',
    age: '',
    date_of_birth: '',
    blood_group: '',
    address: '',
    allergies: '',
    medical_history: '',
    dental_history: '',
    notes: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Fetch full patient data with eager loaded relationships
  const loadPatient = useCallback(async () => {
    if (!patientId) return;
    try {
      let loadedFromApi = false;
      try {
        const res = await fetch(`/api/dental/patients/${patientId}`, {
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = await res.json();
          setPatient(data);
          loadedFromApi = true;
          cacheRecord('patients', data).catch(() => {});
          if (Array.isArray(data.invoices)) cacheRecords('treatments', data.invoices).catch(() => {});
          if (Array.isArray(data.appointments)) cacheRecords('appointments', data.appointments).catch(() => {});
          if (Array.isArray(data.dentalCharts)) cacheRecords('dental_charts', data.dentalCharts).catch(() => {});
        }
      } catch (_) {}

      if (!loadedFromApi) {
        // Fallback to apiClient (reads directly from IndexedDB when offline)
        const { data: pt } = await apiClient
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single();

        if (pt) {
          const [{ data: invs }, { data: appts }, { data: charts }] = await Promise.all([
            apiClient.from('treatments').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
            apiClient.from('appointments').select('*').eq('patient_id', patientId).order('appointment_date', { ascending: false }),
            apiClient.from('dental_charts').select('*').eq('patient_id', patientId).order('tooth_number', { ascending: true }),
          ]);
          setPatient({
            ...(pt as Patient),
            invoices: (invs as DentalTreatment[]) || [],
            appointments: (appts as Appointment[]) || [],
            dentalCharts: (charts as DentalChartEntry[]) || [],
          });
        }
      }
    } catch (err) {
      console.error('Failed to load patient details:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  // Load payment accounts for balance collection
  useEffect(() => {
    if (!currentStore?.id) return;
    (async () => {
      const { data } = await apiClient
        .from('payment_accounts')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('is_active', true);
      if (data) setPaymentAccounts(data);
    })();
  }, [currentStore?.id]);

  // Sync Odontogram chart entries from patient record
  useEffect(() => {
    if (patient) {
      const entries = patient.dentalCharts || patient.dental_charts || [];
      const map: Record<number, DentalChartEntry> = {};
      entries.forEach(e => {
        map[e.tooth_number] = e;
      });
      setChartEntries(map);

      // Populate edit form
      setEditForm({
        full_name: patient.full_name || '',
        phone: patient.phone || '',
        email: patient.email || '',
        gender: patient.gender || 'Male',
        age: patient.age != null ? String(patient.age) : '',
        date_of_birth: patient.date_of_birth ? String(patient.date_of_birth).split('T')[0] : '',
        blood_group: patient.blood_group || '',
        address: patient.address || '',
        allergies: patient.allergies || '',
        medical_history: patient.medical_history || '',
        dental_history: patient.dental_history || '',
        notes: patient.notes || '',
      });
    }
  }, [patient]);

  // Financial Metrics
  const financials = useMemo(() => {
    const invs = patient?.invoices || patient?.treatments || [];
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    invs.forEach(inv => {
      totalInvoiced += Number(inv.total_amount || 0);
      totalPaid += Number(inv.paid_amount || 0);
      totalBalance += Number(inv.balance_amount || 0);
    });

    return {
      totalInvoiced,
      totalPaid,
      totalBalance,
      invoiceCount: invs.length,
    };
  }, [patient]);

  // Odontogram Stats
  const chartStats = useMemo(() => {
    let cariesCount = 0;
    let filledCount = 0;
    let crownCount = 0;
    let rctCount = 0;
    let missingCount = 0;
    let extractionCount = 0;
    let implantCount = 0;

    Object.values(chartEntries).forEach(e => {
      if (e.condition_status === 'caries') cariesCount++;
      else if (e.condition_status === 'filled') filledCount++;
      else if (e.condition_status === 'crown') crownCount++;
      else if (e.condition_status === 'root_canal') rctCount++;
      else if (e.condition_status === 'missing') missingCount++;
      else if (e.condition_status === 'extraction_needed') extractionCount++;
      else if (e.condition_status === 'implant') implantCount++;
    });

    const healthyCount = 32 - cariesCount - extractionCount - missingCount;

    return {
      cariesCount,
      filledCount,
      crownCount,
      rctCount,
      missingCount,
      extractionCount,
      implantCount,
      healthyCount,
    };
  }, [chartEntries]);

  // Tooth selection & saving
  const openToothModal = (tooth: ToothDef) => {
    setActiveTooth(tooth);
    const existing = chartEntries[tooth.num];
    if (existing) {
      setToothForm({
        condition_status: existing.condition_status,
        surface: existing.surface || '',
        diagnosis: existing.diagnosis || '',
        treatment_plan: existing.treatment_plan || '',
        notes: existing.notes || '',
      });
    } else {
      setToothForm({
        condition_status: 'healthy',
        surface: '',
        diagnosis: '',
        treatment_plan: '',
        notes: '',
      });
    }
  };

  const handleSaveTooth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id || !patient?.id || !activeTooth) return;

    setSavingTooth(true);
    const existing = chartEntries[activeTooth.num];
    const payload = {
      store_id: currentStore.id,
      patient_id: patient.id,
      tooth_number: activeTooth.num,
      tooth_name: activeTooth.name,
      condition_status: toothForm.condition_status,
      surface: toothForm.surface.trim(),
      diagnosis: toothForm.diagnosis.trim(),
      treatment_plan: toothForm.treatment_plan.trim(),
      notes: toothForm.notes.trim(),
      updated_by: user?.id || null,
    };

    try {
      if (existing) {
        await apiClient.from('dental_charts').update(payload as any).eq('id', existing.id);
      } else {
        await apiClient.from('dental_charts').insert(payload as any);
      }
      toast.success(`Tooth #${activeTooth.num} (${activeTooth.fdi}) status saved`);
      setActiveTooth(null);
      loadPatient();
    } catch (err) {
      toast.error('Failed to update tooth diagnosis');
    } finally {
      setSavingTooth(false);
    }
  };

  // Profile Edit Handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient?.id) return;
    setSavingProfile(true);

    try {
      const res = await fetch(`/api/dental/patients/${patient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim(),
          email: editForm.email.trim(),
          gender: editForm.gender,
          age: editForm.age ? parseInt(editForm.age) : null,
          date_of_birth: editForm.date_of_birth || null,
          blood_group: editForm.blood_group,
          address: editForm.address.trim(),
          allergies: editForm.allergies.trim(),
          medical_history: editForm.medical_history.trim(),
          dental_history: editForm.dental_history.trim(),
          notes: editForm.notes.trim(),
        }),
      });

      if (!res.ok) {
        // Fallback to apiClient
        await apiClient
          .from('patients')
          .update({
            full_name: editForm.full_name.trim(),
            phone: editForm.phone.trim(),
            email: editForm.email.trim(),
            gender: editForm.gender,
            age: editForm.age ? parseInt(editForm.age) : null,
            date_of_birth: editForm.date_of_birth || null,
            blood_group: editForm.blood_group,
            address: editForm.address.trim(),
            allergies: editForm.allergies.trim(),
            medical_history: editForm.medical_history.trim(),
            dental_history: editForm.dental_history.trim(),
            notes: editForm.notes.trim(),
          } as any)
          .eq('id', patient.id);
      }

      toast.success('Patient profile updated successfully');
      setShowEditModal(false);
      loadPatient();
    } catch (err) {
      toast.error('Failed to update patient profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Collect balance handler
  const handleCollectBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCollectModal || !currentStore?.id) return;

    const addPaid = parseFloat(collectAmount) || 0;
    if (addPaid <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (addPaid > showCollectModal.balance_amount) {
      toast.error(`Amount exceeds remaining balance of ${formatCurrency(showCollectModal.balance_amount)}`);
      return;
    }

    const newPaid = Number(showCollectModal.paid_amount || 0) + addPaid;
    const newBalance = Math.max(0, Number(showCollectModal.balance_amount || 0) - addPaid);
    const newStatus = newBalance === 0 ? 'paid' : 'partial';

    try {
      await apiClient
        .from('treatments')
        .update({
          paid_amount: newPaid,
          balance_amount: newBalance,
          payment_status: newStatus,
          payment_account_id: collectAccountId || showCollectModal.payment_account_id,
        } as any)
        .eq('id', showCollectModal.id);

      // Record in payments table
      await apiClient.from('payments').insert({
        store_id: currentStore.id,
        amount: addPaid,
        method: collectMethod.toLowerCase(),
        payment_account_id: collectAccountId || showCollectModal.payment_account_id || null,
        payment_type: 'dental_invoice',
        direction: 'in',
        reference: showCollectModal.invoice_no,
        created_by: user?.id,
      } as any);

      toast.success(`Payment of ${formatCurrency(addPaid)} recorded successfully`);
      setShowCollectModal(null);
      setCollectAmount('');
      loadPatient();
    } catch (err) {
      toast.error('Failed to record payment');
    }
  };

  if (currentStore && !isDentalClinic) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Patient Details & History" />
        <div className="p-6 max-w-xl mx-auto mt-12 bg-card border border-border rounded-2xl shadow-sm text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
            <Stethoscope size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Dental Clinic Module Required</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Patient clinical files and Odontogram charts are strictly available for dental clinic stores.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Patient Profile" />
        <div className="max-w-7xl mx-auto p-6 text-center text-sm text-muted-foreground py-20">
          Loading patient clinical file & real-time invoices...
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Patient Not Found" />
        <div className="max-w-xl mx-auto p-8 mt-12 bg-card border border-border rounded-2xl text-center space-y-4">
          <AlertTriangle size={36} className="text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Patient Record Not Found</h2>
          <p className="text-sm text-muted-foreground">The requested patient record could not be located in this clinic.</p>
          <button
            onClick={() => navigate('/patients')}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
          >
            Back to Patients Directory
          </button>
        </div>
      </div>
    );
  }

  const invoices = patient.invoices || patient.treatments || [];
  const appointments = patient.appointments || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title={patient.full_name}
        rightAction={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/patients')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 text-xs font-bold border border-border transition-colors"
            >
              <ArrowLeft size={14} /> Back to Patients
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-card text-foreground hover:bg-accent text-xs font-bold border border-border transition-colors"
              title="Print Patient File"
            >
              <Printer size={14} /> Print File
            </button>
            <button
              onClick={() => navigate(`/appointments?patient_id=${patient.id}`)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-bold border border-border transition-colors"
            >
              <Calendar size={14} /> New Appointment
            </button>
            <button
              onClick={() => navigate(`/dental-billing?patient_id=${patient.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
            >
              <Stethoscope size={15} /> New Invoice
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* ==================================================== */}
        {/* COMPREHENSIVE PATIENT HEADER CARD                    */}
        {/* ==================================================== */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            {/* Left: Patient Avatar & Demographics */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-cyan-500/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-2xl shrink-0 shadow-sm">
                {patient.full_name?.charAt(0).toUpperCase() || <User size={28} />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">{patient.full_name}</h1>
                  <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-bold bg-muted text-muted-foreground border border-border">
                    {patient.patient_code || 'ID: ' + patient.id.slice(0, 8)}
                  </span>
                  {patient.blood_group && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                      Blood: {patient.blood_group}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-1">
                  <span>Gender: <strong className="text-foreground">{patient.gender || '—'}</strong></span>
                  {patient.age != null && <span>Age: <strong className="text-foreground">{patient.age} yrs</strong></span>}
                  {patient.date_of_birth && <span>DOB: <strong className="text-foreground">{String(patient.date_of_birth).split('T')[0]}</strong></span>}
                  <span>Registered: <strong className="text-foreground">{new Date(patient.created_at).toLocaleDateString()}</strong></span>
                </div>
              </div>
            </div>

            {/* Right: Quick Action to Edit Profile */}
            <div className="flex items-center gap-2 self-start">
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card text-foreground hover:bg-muted text-xs font-bold border border-border shadow-sm transition-colors"
              >
                <Edit2 size={13} /> Edit Profile
              </button>
            </div>
          </div>

          {/* Contact & Vitals Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Phone size={15} />
              </div>
              <div className="overflow-hidden">
                <span className="text-muted-foreground block text-[11px] font-semibold">Phone Contact</span>
                <span className="font-bold text-foreground truncate block">{patient.phone || 'No phone recorded'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
                <Mail size={15} />
              </div>
              <div className="overflow-hidden">
                <span className="text-muted-foreground block text-[11px] font-semibold">Email Address</span>
                <span className="font-bold text-foreground truncate block">{patient.email || 'No email recorded'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <MapPin size={15} />
              </div>
              <div className="overflow-hidden">
                <span className="text-muted-foreground block text-[11px] font-semibold">Residential Address</span>
                <span className="font-bold text-foreground truncate block">{patient.address || 'No address recorded'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <Receipt size={15} />
              </div>
              <div className="overflow-hidden">
                <span className="text-muted-foreground block text-[11px] font-semibold">Invoices / Treatments</span>
                <span className="font-bold text-foreground block">{invoices.length} Total Visits</span>
              </div>
            </div>
          </div>

          {/* Allergies / Medical Alert Banner */}
          {patient.allergies ? (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-3">
              <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block">
                  Critical Medical & Allergy Alert
                </span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{patient.allergies}</p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} /> No known drug or dental material allergies recorded for this patient.
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* REAL-TIME FINANCIAL SUMMARY CARDS                    */}
        {/* ==================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Invoiced</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{formatCurrency(financials.totalInvoiced)}</h3>
              <span className="text-[11px] text-muted-foreground">{financials.invoiceCount} treatment invoices</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <DollarSign size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Paid</p>
              <h3 className="text-2xl font-bold text-emerald-500 mt-1">{formatCurrency(financials.totalPaid)}</h3>
              <span className="text-[11px] text-emerald-500/80">Collected payments</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Remaining Due</p>
              <h3 className={`text-2xl font-bold mt-1 ${financials.totalBalance > 0 ? 'text-rose-500' : 'text-foreground'}`}>
                {formatCurrency(financials.totalBalance)}
              </h3>
              <span className={`text-[11px] ${financials.totalBalance > 0 ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}>
                {financials.totalBalance > 0 ? 'Outstanding balance' : 'All accounts settled'}
              </span>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${financials.totalBalance > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-muted text-muted-foreground'}`}>
              <CreditCard size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Appointments</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{appointments.length}</h3>
              <span className="text-[11px] text-muted-foreground">Scheduled & completed</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Calendar size={22} />
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* TABS CONTROLLER                                      */}
        {/* ==================================================== */}
        <div className="border-b border-border flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'invoices'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Receipt size={15} />
            <span>Financials & Invoices ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('charting')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'charting'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <HeartPulse size={15} />
            <span>Clinical & Odontogram Chart</span>
          </button>

          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'appointments'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Calendar size={15} />
            <span>Appointments Timeline ({appointments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'history'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <FileText size={15} />
            <span>Medical & Dental History</span>
          </button>
        </div>

        {/* ==================================================== */}
        {/* TAB 1: FINANCIALS & INVOICES (REAL-TIME SYNC)        */}
        {/* ==================================================== */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Treatment Billing & Invoices</h3>
                <p className="text-xs text-muted-foreground">Historical records, procedure details, payments, and outstanding balances.</p>
              </div>
              <button
                onClick={() => navigate(`/dental-billing?patient_id=${patient.id}`)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90"
              >
                <Plus size={14} /> New Treatment Invoice
              </button>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Invoice #</th>
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Procedures & Items</th>
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Doctor</th>
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</th>
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Paid</th>
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Balance Due</th>
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          No invoices recorded for this patient yet. Click "New Treatment Invoice" to bill procedures or items.
                        </td>
                      </tr>
                    ) : (
                      invoices.map(inv => {
                        const isPaid = inv.payment_status === 'paid' || inv.balance_amount === 0;
                        const isPartial = inv.payment_status === 'partial' || (inv.paid_amount > 0 && inv.balance_amount > 0);
                        const isUnpaid = !isPaid && !isPartial;

                        return (
                          <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                              {inv.invoice_no || 'DEN-INV'}
                            </td>
                            <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                              {inv.performed_at ? new Date(inv.performed_at).toLocaleDateString() : new Date(inv.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-foreground block">{inv.procedure_name}</span>
                              {inv.items_detail && inv.items_detail.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {inv.items_detail.map((li, idx) => (
                                    <span
                                      key={idx}
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                        li.type === 'service'
                                          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                                          : 'bg-primary/10 text-primary border-primary/20'
                                      }`}
                                    >
                                      {li.name} (x{li.quantity})
                                    </span>
                                  ))}
                                </div>
                              )}
                              {inv.tooth_numbers && (
                                <span className="text-[10px] text-muted-foreground block mt-0.5">
                                  Teeth: #{inv.tooth_numbers}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-muted-foreground">
                              {inv.doctor_name || 'Clinic Team'}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-foreground">
                              {formatCurrency(inv.total_amount)}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(inv.paid_amount)}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`font-bold ${inv.balance_amount > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                                {formatCurrency(inv.balance_amount)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  isPaid
                                    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                                    : isPartial
                                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                                }`}
                              >
                                {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid / Due'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {inv.balance_amount > 0 && (
                                  <button
                                    onClick={() => {
                                      setShowCollectModal(inv);
                                      setCollectAmount(String(inv.balance_amount));
                                      setCollectAccountId(inv.payment_account_id || '');
                                    }}
                                    className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 font-bold text-xs"
                                    title="Collect Due Balance"
                                  >
                                    Pay Due
                                  </button>
                                )}
                                <button
                                  onClick={() => setShowPrintModal(inv)}
                                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                  title="Print Receipt"
                                >
                                  <Printer size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: CLINICAL & ODONTOGRAM CHART                   */}
        {/* ==================================================== */}
        {activeTab === 'charting' && (
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Interactive Adult Odontogram (Teeth 1 to 32)</h3>
                  <p className="text-xs text-muted-foreground">Click any tooth below to inspect conditions, log restorations, root canals, or planned treatments.</p>
                </div>
                {/* Status Counter */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-500 font-bold border border-emerald-500/30">
                    Healthy: {chartStats.healthyCount}
                  </span>
                  {chartStats.cariesCount > 0 && (
                    <span className="px-2 py-1 rounded-md bg-rose-500/15 text-rose-500 font-bold border border-rose-500/30">
                      Caries: {chartStats.cariesCount}
                    </span>
                  )}
                  {chartStats.filledCount > 0 && (
                    <span className="px-2 py-1 rounded-md bg-blue-500/15 text-blue-500 font-bold border border-blue-500/30">
                      Filled: {chartStats.filledCount}
                    </span>
                  )}
                  {chartStats.rctCount > 0 && (
                    <span className="px-2 py-1 rounded-md bg-purple-500/15 text-purple-500 font-bold border border-purple-500/30">
                      RCT: {chartStats.rctCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                {Object.entries(CONDITION_STYLES).map(([key, item]) => (
                  <div key={key} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${item.bg} ${item.text} ${item.border}`}>
                    {item.label}
                  </div>
                ))}
              </div>

              {/* Odontogram Visual Blocks */}
              <div className="space-y-6 pt-4">
                {/* Maxillary Arch (Upper 1 to 16) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                    <span>Upper Arch (Maxillary)</span>
                    <span className="text-[10px]">Right (1 - 8) | Left (9 - 16)</span>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 overflow-x-auto p-2 bg-muted/20 rounded-xl border border-border">
                    {TOOTH_DEFINITIONS.filter(t => t.arch === 'upper').map(tooth => {
                      const entry = chartEntries[tooth.num];
                      const status = entry?.condition_status || 'healthy';
                      const style = CONDITION_STYLES[status];

                      return (
                        <button
                          key={tooth.num}
                          onClick={() => openToothModal(tooth)}
                          title={`#${tooth.num} (FDI ${tooth.fdi}): ${tooth.name} - ${style.label}`}
                          className={`flex flex-col items-center justify-between p-2 rounded-xl border transition-all text-center relative group min-w-[54px] hover:scale-105 shadow-sm ${style.bg} ${style.border}`}
                        >
                          <span className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-foreground">
                            #{tooth.num}
                          </span>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center my-1 font-bold text-xs shadow-inner border border-white/10">
                            <span className={style.text}>
                              {status === 'missing' ? '✕' : status === 'root_canal' ? 'RCT' : status === 'implant' ? 'IMP' : tooth.fdi}
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold uppercase truncate max-w-full ${style.text}`}>
                            {style.label.split(' ')[0]}
                          </span>
                          {entry?.treatment_plan && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-500 ring-2 ring-background" title="Treatment Plan Attached" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mandibular Arch (Lower 32 to 17) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                    <span>Lower Arch (Mandibular)</span>
                    <span className="text-[10px]">Right (32 - 25) | Left (24 - 17)</span>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 overflow-x-auto p-2 bg-muted/20 rounded-xl border border-border">
                    {TOOTH_DEFINITIONS.filter(t => t.arch === 'lower').map(tooth => {
                      const entry = chartEntries[tooth.num];
                      const status = entry?.condition_status || 'healthy';
                      const style = CONDITION_STYLES[status];

                      return (
                        <button
                          key={tooth.num}
                          onClick={() => openToothModal(tooth)}
                          title={`#${tooth.num} (FDI ${tooth.fdi}): ${tooth.name} - ${style.label}`}
                          className={`flex flex-col items-center justify-between p-2 rounded-xl border transition-all text-center relative group min-w-[54px] hover:scale-105 shadow-sm ${style.bg} ${style.border}`}
                        >
                          <span className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-foreground">
                            #{tooth.num}
                          </span>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center my-1 font-bold text-xs shadow-inner border border-white/10">
                            <span className={style.text}>
                              {status === 'missing' ? '✕' : status === 'root_canal' ? 'RCT' : status === 'implant' ? 'IMP' : tooth.fdi}
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold uppercase truncate max-w-full ${style.text}`}>
                            {style.label.split(' ')[0]}
                          </span>
                          {entry?.treatment_plan && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-500 ring-2 ring-background" title="Treatment Plan Attached" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Charted Findings & Treatment Plans Table */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
              <h4 className="text-sm font-bold text-foreground">Charted Teeth Findings & Treatment Notes</h4>
              {Object.keys(chartEntries).length === 0 ? (
                <p className="text-xs text-muted-foreground">No specific tooth findings or notes recorded yet. Click on any tooth on the odontogram above to add findings.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.values(chartEntries).map(entry => {
                    const style = CONDITION_STYLES[entry.condition_status];
                    return (
                      <div key={entry.id} className="p-3.5 rounded-xl bg-muted/20 border border-border space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">Tooth #{entry.tooth_number} ({entry.tooth_name})</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                            {style.label}
                          </span>
                        </div>
                        {entry.surface && (
                          <span className="text-muted-foreground block text-[11px]">Surface: <strong>{entry.surface}</strong></span>
                        )}
                        {entry.diagnosis && (
                          <p className="text-foreground"><strong className="text-muted-foreground">Diagnosis:</strong> {entry.diagnosis}</p>
                        )}
                        {entry.treatment_plan && (
                          <p className="text-cyan-500 font-medium"><strong className="text-muted-foreground">Plan:</strong> {entry.treatment_plan}</p>
                        )}
                        {entry.notes && (
                          <p className="text-muted-foreground text-[11px] italic">{entry.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: APPOINTMENTS TIMELINE                         */}
        {/* ==================================================== */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Appointments Timeline</h3>
                <p className="text-xs text-muted-foreground">Past visits and scheduled upcoming appointments.</p>
              </div>
              <button
                onClick={() => navigate(`/appointments?patient_id=${patient.id}`)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90"
              >
                <Plus size={14} /> Schedule Appointment
              </button>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase tracking-wider">Date & Time</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase tracking-wider">Doctor</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase tracking-wider">Duration</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase tracking-wider">Reason for Visit</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 font-bold text-muted-foreground uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appointments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          No appointments recorded for this patient. Click "Schedule Appointment" to book their visit.
                        </td>
                      </tr>
                    ) : (
                      appointments.map(apt => (
                        <tr key={apt.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-foreground whitespace-nowrap">
                            {apt.appointment_date} {apt.appointment_time ? `at ${apt.appointment_time}` : ''}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-foreground">
                            {apt.doctor_name || 'General Dentist'}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground">
                            {apt.duration_minutes || 30} mins
                          </td>
                          <td className="py-3.5 px-4 font-medium text-foreground">
                            {apt.reason || 'Checkup & Consultation'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                apt.status === 'completed'
                                  ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                                  : apt.status === 'in_progress'
                                  ? 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30'
                                  : apt.status === 'cancelled'
                                  ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                                  : 'bg-primary/15 text-primary border-primary/30'
                              }`}
                            >
                              {apt.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground italic">
                            {apt.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: MEDICAL & DENTAL HISTORY                      */}
        {/* ==================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Clinical & Dental Background</h3>
                <p className="text-xs text-muted-foreground">Medical history, systemic conditions, prior dental treatments, and allergies.</p>
              </div>
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card text-foreground hover:bg-muted text-xs font-bold border border-border shadow-sm"
              >
                <Edit2 size={13} /> Edit History
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-rose-500 font-bold uppercase tracking-wider text-xs">
                  <ShieldAlert size={16} /> Known Allergies & Sensitivities
                </div>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border text-foreground leading-relaxed">
                  {patient.allergies || 'No known drug or material allergies.'}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-cyan-500 font-bold uppercase tracking-wider text-xs">
                  <HeartPulse size={16} /> Systemic Medical History
                </div>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border text-foreground leading-relaxed whitespace-pre-wrap">
                  {patient.medical_history || 'No medical conditions or ongoing medications recorded.'}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-xs">
                  <Stethoscope size={16} /> Prior Dental History
                </div>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border text-foreground leading-relaxed whitespace-pre-wrap">
                  {patient.dental_history || 'No prior dental interventions or extractions recorded.'}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase tracking-wider text-xs">
                  <FileText size={16} /> Clinical Notes & Instructions
                </div>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border text-foreground leading-relaxed whitespace-pre-wrap">
                  {patient.notes || 'No general clinical notes recorded for this patient.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* TOOTH DIAGNOSIS MODAL                                */}
      {/* ==================================================== */}
      {activeTooth && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveTooth(null)}>
          <div className="bg-card rounded-2xl border border-border max-w-md w-full p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-xs font-mono text-muted-foreground">Universal #{activeTooth.num} · FDI {activeTooth.fdi}</span>
                <h3 className="text-base font-bold text-foreground">{activeTooth.name}</h3>
              </div>
              <button onClick={() => setActiveTooth(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTooth} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Tooth Condition Status *</label>
                <select
                  value={toothForm.condition_status}
                  onChange={e => setToothForm({ ...toothForm, condition_status: e.target.value as any })}
                  className="w-full px-3 h-9 rounded-lg border border-input bg-background font-bold text-foreground"
                >
                  {Object.entries(CONDITION_STYLES).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Surface (Optional)</label>
                <input
                  type="text"
                  value={toothForm.surface}
                  onChange={e => setToothForm({ ...toothForm, surface: e.target.value })}
                  placeholder="e.g. Occlusal, Mesial, Buccal, Lingual"
                  className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={toothForm.diagnosis}
                  onChange={e => setToothForm({ ...toothForm, diagnosis: e.target.value })}
                  placeholder="e.g. Enamel caries, Deep fissure"
                  className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-bold text-cyan-500 uppercase tracking-wider block mb-1">Treatment Plan</label>
                <input
                  type="text"
                  value={toothForm.treatment_plan}
                  onChange={e => setToothForm({ ...toothForm, treatment_plan: e.target.value })}
                  placeholder="e.g. Composite filling, Root Canal Therapy"
                  className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Clinical Notes</label>
                <textarea
                  rows={2}
                  value={toothForm.notes}
                  onChange={e => setToothForm({ ...toothForm, notes: e.target.value })}
                  placeholder="Additional observations or notes..."
                  className="w-full p-2.5 rounded-lg border border-input bg-background text-foreground"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/dental-billing?patient_id=${patient.id}&procedure=${encodeURIComponent(toothForm.treatment_plan || 'Dental Procedure')}&tooth=${activeTooth.num}`);
                  }}
                  className="text-primary hover:underline text-xs font-bold"
                >
                  Bill Treatment for Tooth #{activeTooth.num} &rarr;
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTooth(null)}
                    className="px-3 py-1.5 rounded-lg bg-muted text-foreground font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTooth}
                    className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {savingTooth ? 'Saving...' : 'Save Diagnosis'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* EDIT PATIENT PROFILE MODAL                           */}
      {/* ==================================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-card rounded-2xl border border-border max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Edit Patient Profile & Medical History</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full px-3 h-9 rounded-lg border border-input bg-background font-bold text-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Age</label>
                    <input
                      type="number"
                      value={editForm.age}
                      onChange={e => setEditForm({ ...editForm, age: e.target.value })}
                      className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Blood Group</label>
                    <select
                      value={editForm.blood_group}
                      onChange={e => setEditForm({ ...editForm, blood_group: e.target.value })}
                      className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                    >
                      <option value="">—</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Address / City</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-rose-500 uppercase tracking-wider block mb-1">Allergies & Critical Alerts</label>
                  <input
                    type="text"
                    value={editForm.allergies}
                    onChange={e => setEditForm({ ...editForm, allergies: e.target.value })}
                    placeholder="Penicillin, latex, local anesthetics..."
                    className="w-full px-3 h-9 rounded-lg border border-rose-500/30 bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Medical History</label>
                  <textarea
                    rows={2}
                    value={editForm.medical_history}
                    onChange={e => setEditForm({ ...editForm, medical_history: e.target.value })}
                    placeholder="Hypertension, diabetes, asthma..."
                    className="w-full p-2.5 rounded-lg border border-input bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Dental History</label>
                  <textarea
                    rows={2}
                    value={editForm.dental_history}
                    onChange={e => setEditForm({ ...editForm, dental_history: e.target.value })}
                    placeholder="Prior root canals, sensitivity, braces..."
                    className="w-full p-2.5 rounded-lg border border-input bg-background text-foreground"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Clinical Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-input bg-background text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-muted text-foreground font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* COLLECT BALANCE DUE MODAL                            */}
      {/* ==================================================== */}
      {showCollectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCollectModal(null)}>
          <div className="bg-card rounded-2xl border border-border max-w-md w-full p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-xs font-mono text-muted-foreground">{showCollectModal.invoice_no}</span>
                <h3 className="text-base font-bold text-foreground">Collect Remaining Balance</h3>
              </div>
              <button onClick={() => setShowCollectModal(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCollectBalance} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Invoiced:</span>
                  <span className="font-bold text-foreground">{formatCurrency(showCollectModal.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Already Paid:</span>
                  <span className="font-semibold text-emerald-500">{formatCurrency(showCollectModal.paid_amount)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-bold">
                  <span className="text-rose-500">Remaining Balance:</span>
                  <span className="text-rose-500">{formatCurrency(showCollectModal.balance_amount)}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Amount to Pay Now *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={showCollectModal.balance_amount}
                  value={collectAmount}
                  onChange={e => setCollectAmount(e.target.value)}
                  className="w-full px-3 h-10 rounded-lg border border-input bg-background font-bold text-foreground text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Payment Method</label>
                  <select
                    value={collectMethod}
                    onChange={e => setCollectMethod(e.target.value)}
                    className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                  >
                    <option value="cash">Cash</option>
                    <option value="evc_plus">EVC Plus</option>
                    <option value="zaad">Zaad</option>
                    <option value="sahal">Sahal</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-muted-foreground uppercase tracking-wider block mb-1">Deposit To Ledger</label>
                  <select
                    value={collectAccountId}
                    onChange={e => setCollectAccountId(e.target.value)}
                    className="w-full px-3 h-9 rounded-lg border border-input bg-background text-foreground"
                  >
                    <option value="">Default Account</option>
                    {paymentAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(null)}
                  className="px-3.5 py-2 rounded-lg bg-muted text-foreground font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* PRINTABLE ITEMIZED DENTAL INVOICE MODAL              */}
      {/* ==================================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrintModal(null)}>
          <div className="bg-white text-black rounded-2xl max-w-xl w-full p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto print:p-0 print:shadow-none" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wide">{currentStore?.name || 'Dental Clinic'}</h2>
                <p className="text-xs text-gray-500">Official Clinical Treatment Receipt</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-gray-700 block">{showPrintModal.invoice_no}</span>
                <span className="text-xs text-gray-500">{new Date(showPrintModal.performed_at || showPrintModal.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-500 block">Patient Name:</span>
                <strong className="text-sm">{patient.full_name}</strong>
                {patient.patient_code && <span className="text-gray-500 block mt-0.5">ID: {patient.patient_code}</span>}
                {patient.phone && <span className="text-gray-500 block">Phone: {patient.phone}</span>}
              </div>
              <div className="text-right">
                <span className="text-gray-500 block">Attending Doctor:</span>
                <strong className="text-sm">{showPrintModal.doctor_name || 'General Dentist'}</strong>
                {showPrintModal.tooth_numbers && (
                  <span className="text-gray-500 block mt-0.5">Teeth Treated: #{showPrintModal.tooth_numbers}</span>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 font-bold uppercase">
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Type</th>
                    <th className="py-2.5 px-3 text-right">Fee</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {showPrintModal.items_detail && showPrintModal.items_detail.length > 0 ? (
                    showPrintModal.items_detail.map((li, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-semibold">{li.name}</td>
                        <td className="py-2.5 px-3 text-center capitalize text-gray-500">{li.type}</td>
                        <td className="py-2.5 px-3 text-right">{formatCurrency(li.unit_price)}</td>
                        <td className="py-2.5 px-3 text-center">{li.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-bold">{formatCurrency(li.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-2.5 px-3 font-semibold">{showPrintModal.procedure_name}</td>
                      <td className="py-2.5 px-3 text-center text-gray-500">Service</td>
                      <td className="py-2.5 px-3 text-right">{formatCurrency(showPrintModal.cost)}</td>
                      <td className="py-2.5 px-3 text-center">1</td>
                      <td className="py-2.5 px-3 text-right font-bold">{formatCurrency(showPrintModal.total_amount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Breakdown */}
            <div className="space-y-1.5 text-xs text-right max-w-xs ml-auto pt-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-semibold">{formatCurrency(showPrintModal.cost || showPrintModal.total_amount)}</span>
              </div>
              {showPrintModal.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(showPrintModal.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-gray-300 pt-1.5 text-black">
                <span>Grand Total:</span>
                <span>{formatCurrency(showPrintModal.total_amount)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Amount Paid:</span>
                <span>{formatCurrency(showPrintModal.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5">
                <span className={showPrintModal.balance_amount > 0 ? 'text-rose-600' : 'text-gray-600'}>
                  Balance Due:
                </span>
                <span className={showPrintModal.balance_amount > 0 ? 'text-rose-600' : 'text-gray-600'}>
                  {formatCurrency(showPrintModal.balance_amount)}
                </span>
              </div>
            </div>

            {showPrintModal.prescription && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                <span className="font-bold text-gray-700 block mb-1">Prescription & Advice:</span>
                <p className="text-gray-600 whitespace-pre-wrap">{showPrintModal.prescription}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t print:hidden">
              <button
                onClick={() => setShowPrintModal(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

