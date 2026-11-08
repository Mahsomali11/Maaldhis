import { useState, useEffect, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import type { Doctor } from '@/types';
import { toast } from 'sonner';
import {
  UserCheck, Plus, Search, Phone, Mail, Clock, Stethoscope, Edit2, Trash2,
  X, CheckCircle2, ShieldCheck, Calendar, Lock, Eye, EyeOff, Sparkles, Filter,
  Layers, Users, AlertCircle, AlertTriangle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const DENTAL_SPECIALIZATIONS = [
  'General Dentist',
  'Orthodontist (Braces & Aligners)',
  'Endodontist (Root Canal Specialist)',
  'Periodontist (Gum Disease)',
  'Oral & Maxillofacial Surgeon',
  'Pediatric Dentist (Pedodontist)',
  'Prosthodontist (Crowns, Bridges & Implants)',
  'Cosmetic & Aesthetic Dentist',
  'Dental Hygienist',
  'Consultant Dentist',
];

const QUICK_SCHEDULES = [
  'Mon - Fri: 08:30 AM - 04:30 PM',
  'Mon - Sat: 09:00 AM - 05:00 PM',
  'Mon - Thu: 09:00 AM - 06:00 PM',
  'Sat - Wed: 08:00 AM - 02:00 PM',
  'Part-time: Tue & Thu (09:00 AM - 01:00 PM)',
  'On-Call Specialist',
];

export default function DoctorsPage() {
  const { currentStore, user, formatCurrency } = useApp();
  const navigate = (url: string) => router.visit(url);
  const isDentalClinic = currentStore?.business_type === 'dental_clinic';

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    specialization: DENTAL_SPECIALIZATIONS[0],
    custom_specialization: '',
    phone: '',
    email: '',
    working_hours: QUICK_SCHEDULES[1],
    password: '',
    is_active: true,
    notes: '',
  });

  const loadDoctors = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dental/doctors?store_id=${currentStore.id}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data : []);
      } else {
        // Fallback to apiClient dynamic table
        const { data } = await apiClient
          .from('doctors')
          .select('*')
          .eq('store_id', currentStore.id)
          .order('name', { ascending: true });
        if (data) setDoctors(data as Doctor[]);
      }
    } catch (err) {
      // Fallback
      const { data } = await apiClient
        .from('doctors')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('name', { ascending: true });
      if (data) setDoctors(data as Doctor[]);
    } finally {
      setLoading(false);
    }
  }, [currentStore?.id]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const openNewDoctorModal = () => {
    setEditingDoctor(null);
    setForm({
      name: '',
      specialization: DENTAL_SPECIALIZATIONS[0],
      custom_specialization: '',
      phone: '',
      email: '',
      working_hours: QUICK_SCHEDULES[1],
      password: 'Doctor@123',
      is_active: true,
      notes: '',
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const openEditDoctorModal = (doc: Doctor) => {
    setEditingDoctor(doc);
    const isStandardSpec = DENTAL_SPECIALIZATIONS.includes(doc.specialization);
    setForm({
      name: doc.name,
      specialization: isStandardSpec ? doc.specialization : 'Other',
      custom_specialization: isStandardSpec ? '' : doc.specialization,
      phone: doc.phone || '',
      email: doc.email || '',
      working_hours: doc.working_hours || QUICK_SCHEDULES[1],
      password: '',
      is_active: doc.is_active !== false,
      notes: doc.notes || '',
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id) return;

    if (!form.name.trim()) {
      toast.error('Doctor full name is required');
      return;
    }

    if (!form.email.trim()) {
      toast.error('Email address is required for staff account creation');
      return;
    }

    const finalSpecialization =
      form.specialization === 'Other'
        ? form.custom_specialization.trim() || 'Dental Specialist'
        : form.specialization;

    setSaving(true);
    try {
      if (editingDoctor) {
        const payload: any = {
          name: form.name.trim(),
          specialization: finalSpecialization,
          phone: form.phone.trim(),
          email: form.email.trim().toLowerCase(),
          working_hours: form.working_hours.trim(),
          is_active: form.is_active,
          notes: form.notes.trim(),
        };
        if (form.password.trim()) {
          payload.password = form.password.trim();
        }

        const res = await fetch(`/api/dental/doctors/${editingDoctor.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to update doctor');
        }

        toast.success('Doctor profile and staff credentials updated successfully!');
      } else {
        const payload = {
          store_id: currentStore.id,
          name: form.name.trim(),
          specialization: finalSpecialization,
          phone: form.phone.trim(),
          email: form.email.trim().toLowerCase(),
          working_hours: form.working_hours.trim(),
          password: form.password.trim() || 'Doctor@123',
          notes: form.notes.trim(),
        };

        const res = await fetch('/api/dental/doctors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to create doctor');
        }

        toast.success('Doctor created & synchronized with Staff Accounts (Role: Dentist)!');
      }

      setShowModal(false);
      loadDoctors();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/dental/doctors/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete doctor');
      }

      toast.success('Doctor removed or deactivated safely');
      loadDoctors();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove doctor');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Metrics
  const summary = useMemo(() => {
    const total = doctors.length;
    const active = doctors.filter(d => d.is_active !== false).length;
    const specializations = new Set(doctors.map(d => d.specialization).filter(Boolean)).size;
    return { total, active, specializations };
  }, [doctors]);

  // Filtered doctors
  const filteredDoctors = useMemo(() => {
    const q = search.toLowerCase().trim();
    return doctors.filter(doc => {
      const matchesSearch =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.specialization?.toLowerCase().includes(q) ||
        doc.email?.toLowerCase().includes(q) ||
        doc.phone?.toLowerCase().includes(q);

      const matchesSpec =
        specializationFilter === 'all' || doc.specialization === specializationFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && doc.is_active !== false) ||
        (statusFilter === 'inactive' && doc.is_active === false);

      return matchesSearch && matchesStatus;
    });
  }, [doctors, search, specializationFilter, statusFilter]);

  // Isolation Guardrail
  if (currentStore && !isDentalClinic) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Doctors Management" />
        <div className="p-6 max-w-xl mx-auto text-center mt-12 bg-card rounded-2xl border border-border p-8 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Stethoscope size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Dental Clinic Module Required</h2>
          <p className="text-sm text-muted-foreground">
            The Doctors Directory is strictly isolated to stores operating with the{' '}
            <strong>Dental Clinic</strong> business type. Your current store is in{' '}
            <strong>
              {currentStore.business_type === 'grocery_bulk'
                ? 'Grocery / Bulk Retail'
                : 'Standard Retail'}
            </strong>{' '}
            mode.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Doctors & Specialists Directory"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/appointments')}
              className="hidden sm:flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-3.5 py-2 rounded-xl text-sm font-semibold border border-border shadow-sm transition-colors"
            >
              <Calendar size={15} />
              <span>Appointments</span>
            </button>
            <button
              onClick={() => navigate('/staff-accounts')}
              className="hidden sm:flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-3.5 py-2 rounded-xl text-sm font-semibold border border-border shadow-sm transition-colors"
            >
              <ShieldCheck size={15} />
              <span>Staff Accounts</span>
            </button>
            <button
              onClick={openNewDoctorModal}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              <span>Add Doctor</span>
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Sync Info Banner */}
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-cyan-950 dark:text-cyan-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">Two-Way Automatic Synchronization Active</p>
              <p className="text-xs text-muted-foreground">
                Adding a doctor automatically provisions a Staff Account with the role{' '}
                <strong>Dental Doctor / Dentist</strong>. Changes to names or emails update seamlessly across both directories.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/staff-accounts')}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            Manage Permissions &rarr;
          </button>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground capitalize tracking-wider">
                Total Doctors
              </span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Stethoscope size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{summary.total}</p>
            <span className="text-[11px] text-muted-foreground font-medium">In clinical roster</span>
          </div>

          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground capitalize tracking-wider">
                Active on Duty
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              {summary.active}
            </p>
            <span className="text-[11px] text-muted-foreground font-medium">Available for booking</span>
          </div>

          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground capitalize tracking-wider">
                Specializations
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Layers size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">{summary.specializations}</p>
            <span className="text-[11px] text-muted-foreground font-medium">Distinct disciplines</span>
          </div>

          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground capitalize tracking-wider">
                Staff Sync
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">100%</p>
            <span className="text-[11px] text-muted-foreground font-medium">Linked to Staff Accounts</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search by doctor name, specialization, email, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={specializationFilter}
              onChange={e => setSpecializationFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-input rounded-xl text-xs font-medium focus:outline-none"
            >
              <option value="all">All Disciplines</option>
              {DENTAL_SPECIALIZATIONS.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-background border border-input rounded-xl text-xs font-medium focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Doctors Table */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs font-bold text-muted-foreground uppercase border-b border-border">
              <tr>
                <th className="px-5 py-3.5">Doctor & Title</th>
                <th className="px-5 py-3.5">Specialization</th>
                <th className="px-5 py-3.5">Working Hours / Schedule</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    Loading doctors directory...
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Stethoscope size={36} className="text-muted-foreground/30" />
                      <p className="font-semibold text-foreground">No doctors found</p>
                      <p className="text-xs">Add your first clinic doctor or adjust your search.</p>
                      <button
                        onClick={openNewDoctorModal}
                        className="mt-2 px-3.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold"
                      >
                        Add Doctor
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDoctors.map(doc => (
                  <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {doc.name.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            <span>{doc.name}</span>
                            {doc.staff_account_id && (
                              <span
                                title="Synchronized with Staff Accounts (Role: Dentist)"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20"
                              >
                                <ShieldCheck size={10} /> Synced
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{doc.email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {doc.specialization || 'General Dentist'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                        <Clock size={13} className="text-muted-foreground shrink-0" />
                        <span>{doc.working_hours || 'Mon - Sat: 09:00 AM - 05:00 PM'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Phone size={12} className="text-muted-foreground shrink-0" />
                          <span>{doc.phone || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail size={12} className="shrink-0" />
                          <span className="truncate max-w-[160px]">{doc.email || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          doc.is_active !== false
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {doc.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/appointments?doctor_id=${doc.id}&doctor_name=${encodeURIComponent(doc.name)}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Schedule Patient Appointment with Doctor"
                        >
                          <Calendar size={13} />
                          <span>Book</span>
                        </button>
                        <button
                          onClick={() => openEditDoctorModal(doc)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit Doctor Profile"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove Doctor"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading doctors...</div>
          ) : filteredDoctors.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground">
              No doctors found.
            </div>
          ) : (
            filteredDoctors.map(doc => (
              <div key={doc.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {doc.name.replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">{doc.name}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {doc.specialization}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      doc.is_active !== false
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {doc.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground space-y-1 bg-muted/20 p-2.5 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="shrink-0" />
                    <span>{doc.working_hours || 'Mon - Sat: 09:00 AM - 05:00 PM'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="shrink-0" />
                    <span>{doc.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="shrink-0" />
                    <span className="truncate">{doc.email || 'No email'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
                  <button
                    onClick={() => navigate(`/appointments?doctor_id=${doc.id}&doctor_name=${encodeURIComponent(doc.name)}`)}
                    className="flex-1 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Calendar size={13} />
                    <span>Book</span>
                  </button>
                  <button
                    onClick={() => openEditDoctorModal(doc)}
                    className="p-2 rounded-xl bg-muted text-foreground text-xs font-semibold"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(doc)}
                    className="p-2 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Doctor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <Stethoscope size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {editingDoctor ? 'Edit Doctor Profile' : 'Add New Dental Doctor'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {editingDoctor
                      ? 'Update doctor details and synchronized staff credentials'
                      : 'Automatically provisions a staff account with Dentist role'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Doctor Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Doctor Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ahmed Hassan"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Specialization / Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Specialization / Clinical Title <span className="text-destructive">*</span>
                </label>
                <select
                  value={form.specialization}
                  onChange={e => setForm({ ...form, specialization: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {DENTAL_SPECIALIZATIONS.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                  <option value="Other">Other / Custom Specialization...</option>
                </select>
                {form.specialization === 'Other' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom title / specialization..."
                    value={form.custom_specialization}
                    onChange={e => setForm({ ...form, custom_specialization: e.target.value })}
                    className="w-full mt-2 px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                )}
              </div>

              {/* Contact Information (Email & Phone) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Email Address (Login Username) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="doctor@clinic.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+252 61..."
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Staff Login Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  {editingDoctor ? 'Update Staff Login Password (Optional)' : 'Staff Account Login Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editingDoctor ? 'Leave blank to keep existing password' : 'Initial password (e.g. Doctor@123)'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                  <ShieldCheck size={12} className="text-primary" />
                  Doctor can use this password along with their email to log in to the Clinic portal.
                </p>
              </div>

              {/* Working Hours & Schedule */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Working Hours / Shift Schedule
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mon - Sat: 09:00 AM - 05:00 PM"
                  value={form.working_hours}
                  onChange={e => setForm({ ...form, working_hours: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_SCHEDULES.slice(0, 3).map(sch => (
                    <button
                      key={sch}
                      type="button"
                      onClick={() => setForm({ ...form, working_hours: sch })}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    >
                      {sch}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Clinical Notes / Bio (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Bio, qualifications, licensing number, or clinic room..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              {/* Active Toggle if Editing */}
              {editingDoctor && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Active on Duty</span>
                    <span className="text-[11px] text-muted-foreground">
                      Deactivating hides the doctor from the appointment booking picker.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? 'Saving...' : editingDoctor ? 'Save Changes' : 'Create & Sync Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove / Deactivate Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-3xl p-0 overflow-hidden border-border">
          <AlertDialogHeader className="p-6 pb-0">
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              Remove Doctor Profile
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-sm font-medium">
              Are you sure you want to remove <span className="font-bold text-foreground">"{deleteTarget?.name}"</span>?
              If this doctor has historical appointment records, they will be safely marked as inactive to protect clinical history.
              The linked staff account will also be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-6 bg-muted/10 mt-4 border-t border-border/50 sm:justify-between">
            <AlertDialogCancel className="rounded-xl border-border bg-background hover:bg-muted font-bold px-6 h-11">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold px-6 h-11 shadow-sm"
            >
              Yes, Remove Doctor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

