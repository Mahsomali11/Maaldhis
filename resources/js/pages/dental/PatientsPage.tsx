import { useState, useEffect, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import type { Patient } from '@/types';
import { toast } from 'sonner';
import {
  Users, Plus, Search, Phone, Mail, MapPin, AlertTriangle, Edit2, Trash2,
  HeartPulse, Calendar, Stethoscope, FileText, X, User
} from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientsPage() {
  const { currentStore, user } = useApp();
  const navigate = (url: string) => router.visit(url);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
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

  const loadPatients = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    const { data, error } = await apiClient
      .from('patients')
      .select('*')
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setPatients(data as Patient[]);
    }
    setLoading(false);
  }, [currentStore?.id]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const openAddModal = () => {
    setEditingPatient(null);
    setForm({
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
    setShowModal(true);
  };

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setForm({
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
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id) return;
    if (!form.full_name.trim()) {
      toast.error('Patient full name is required');
      return;
    }

    setSaving(true);
    const payload = {
      store_id: currentStore.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      gender: form.gender,
      age: form.age ? parseInt(form.age, 10) : null,
      date_of_birth: form.date_of_birth || null,
      blood_group: form.blood_group || null,
      address: form.address.trim(),
      allergies: form.allergies.trim(),
      medical_history: form.medical_history.trim(),
      dental_history: form.dental_history.trim(),
      notes: form.notes.trim(),
    };

    if (editingPatient) {
      const { error } = await apiClient
        .from('patients')
        .update(payload as any)
        .eq('id', editingPatient.id);
      if (error) {
        toast.error('Failed to update patient record');
      } else {
        toast.success('Patient record updated');
        setShowModal(false);
        loadPatients();
      }
    } else {
      const code = `PT-${String(patients.length + 1).padStart(4, '0')}`;
      const { error } = await apiClient
        .from('patients')
        .insert({ ...payload, patient_code: code } as any);
      if (error) {
        toast.error('Failed to create patient record');
      } else {
        toast.success('Patient registered successfully');
        setShowModal(false);
        loadPatients();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (patient: Patient) => {
    if (!confirm(`Delete patient record for "${patient.full_name}"?`)) return;
    const { error } = await apiClient.from('patients').delete().eq('id', patient.id);
    if (error) {
      toast.error('Failed to delete patient');
    } else {
      toast.success('Patient deleted');
      if (selectedPatient?.id === patient.id) setSelectedPatient(null);
      loadPatients();
    }
  };

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter(p =>
      p.full_name?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.patient_code?.toLowerCase().includes(q) ||
      p.allergies?.toLowerCase().includes(q)
    );
  }, [patients, search]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Dental Patients"
        rightAction={
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            <span>Register Patient</span>
          </button>
        }
      />

      <div className="p-4 sm:p-6 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Registered Patients</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{patients.length}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Patients with Allergy Alerts</p>
              <h3 className="text-2xl font-bold text-amber-500 mt-1">
                {patients.filter(p => p.allergies && p.allergies.trim().length > 0).length}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">New This Month</p>
              <h3 className="text-2xl font-bold text-emerald-500 mt-1">
                {patients.filter(p => {
                  const d = new Date(p.created_at);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <HeartPulse size={22} />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by patient name, code, phone, or allergy..."
              className="w-full pl-10 pr-4 h-10 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Patients Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Code</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Patient Name</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Gender / Age</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Allergies / Medical Alerts</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Clinical Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Loading patient records...</td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      No patient records found. Click "Register Patient" to add your first dental patient.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map(patient => (
                    <tr key={patient.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-mono font-semibold text-muted-foreground">
                        {patient.patient_code || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => navigate(`/dental/patients/${patient.id}`)}
                          className="text-sm font-bold text-foreground hover:text-primary hover:underline text-left block"
                          title="View dedicated patient profile, invoices & clinical history"
                        >
                          {patient.full_name}
                        </button>
                        {patient.address && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin size={11} /> {patient.address}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-muted-foreground">
                        <span>{patient.gender || '—'}</span>
                        {patient.age != null && <span> · {patient.age} yrs</span>}
                        {patient.blood_group && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                            {patient.blood_group}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-muted-foreground">
                        {patient.phone ? (
                          <div className="flex items-center gap-1.5 text-foreground text-xs font-medium">
                            <Phone size={12} className="text-muted-foreground" /> {patient.phone}
                          </div>
                        ) : '—'}
                        {patient.email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-0.5">
                            <Mail size={11} /> {patient.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {patient.allergies ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-500 border border-red-500/30">
                            <AlertTriangle size={12} /> {patient.allergies}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No known allergies</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => navigate(`/dental/patients/${patient.id}`)}
                            className="px-2.5 py-1.5 rounded-md bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="View Patient Profile & Invoices"
                          >
                            <User size={13} /> View
                          </button>
                          <button
                            onClick={() => navigate(`/dental-charting?patient_id=${patient.id}`)}
                            className="px-2.5 py-1.5 rounded-md bg-cyan-500/15 text-cyan-500 hover:bg-cyan-500/25 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Open Dental Chart"
                          >
                            <HeartPulse size={13} /> Chart
                          </button>
                          <button
                            onClick={() => navigate(`/appointments?patient_id=${patient.id}`)}
                            className="px-2.5 py-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Book Appointment"
                          >
                            <Calendar size={13} /> Appoint
                          </button>
                          <button
                            onClick={() => navigate(`/dental-billing?patient_id=${patient.id}`)}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Bill Treatment"
                          >
                            <Stethoscope size={13} /> Bill
                          </button>
                          <button
                            onClick={() => openEditModal(patient)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit Patient"
                          >
                            <Edit2 size={14} />
                          </button>
                          {(user?.role === 'owner' || user?.role === 'admin' || user?.role === 'clinic_admin') && (
                            <button
                              onClick={() => handleDelete(patient)}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete Patient"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-2xl border border-border max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
              <h2 className="text-lg font-bold text-foreground">
                {editingPatient ? 'Edit Patient Record' : 'Register New Dental Patient'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="e.g. Amina Hassan"
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. +252 61..."
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="patient@example.com"
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={e => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Age (Yrs)</label>
                    <input
                      type="number"
                      min="0"
                      max="130"
                      value={form.age}
                      onChange={e => setForm({ ...form, age: e.target.value })}
                      placeholder="e.g. 28"
                      className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Blood Group</label>
                    <select
                      value={form.blood_group}
                      onChange={e => setForm({ ...form, blood_group: e.target.value })}
                      className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                    >
                      <option value="">—</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Address / City</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    placeholder="Residential area or city"
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-red-500 uppercase tracking-wider block mb-1">
                    Known Allergies (Penicillin, Latex, Local Anesthetics, etc.)
                  </label>
                  <input
                    type="text"
                    value={form.allergies}
                    onChange={e => setForm({ ...form, allergies: e.target.value })}
                    placeholder="Leave blank if none, or list drug/material allergies..."
                    className="w-full px-3.5 h-10 rounded-lg border border-red-500/30 bg-background text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Medical History</label>
                  <textarea
                    rows={3}
                    value={form.medical_history}
                    onChange={e => setForm({ ...form, medical_history: e.target.value })}
                    placeholder="Diabetes, hypertension, current medications, pregnancy..."
                    className="w-full p-3 rounded-lg border border-input bg-background text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Dental History</label>
                  <textarea
                    rows={3}
                    value={form.dental_history}
                    onChange={e => setForm({ ...form, dental_history: e.target.value })}
                    placeholder="Prior extractions, root canals, braces, sensitivity..."
                    className="w-full p-3 rounded-lg border border-input bg-background text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingPatient ? 'Save Changes' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

