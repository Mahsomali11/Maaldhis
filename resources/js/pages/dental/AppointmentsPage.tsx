import { useState, useEffect, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import type { Appointment, Patient, Doctor } from '@/types';
import { toast } from 'sonner';
import {
  Calendar, Clock, Plus, Search, User, Phone, Stethoscope, CheckCircle2,
  XCircle, PlayCircle, HeartPulse, Edit2, Trash2, X, UserCheck, Layers, Sparkles
} from 'lucide-react';

const COMMON_REASONS = [
  'Dental Consultation & Checkup',
  'Scaling & Polishing (Cleaning)',
  'Composite Tooth Filling',
  'Root Canal Therapy (RCT)',
  'Simple / Surgical Tooth Extraction',
  'Dental Crown / Bridge Fitting',
  'Orthodontic / Braces Adjustment',
  'Teeth Whitening',
  'Dental X-Ray & Diagnostics',
  'Emergency Toothache / Pain Relief',
  'Follow-up Review',
];

export default function AppointmentsPage() {
  const { currentStore, user, formatCurrency } = useApp();
  const navigate = (url: string) => router.visit(url);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    patient_phone: '',
    doctor_id: '',
    doctor_name: user?.full_name || 'Dr. On Duty',
    service_id: '',
    appointment_date: todayStr,
    appointment_time: '09:00',
    duration_minutes: '30',
    reason: COMMON_REASONS[0],
    status: 'scheduled' as Appointment['status'],
    notes: '',
  });

  const loadData = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    const [
      { data: apptData },
      { data: ptData },
      { data: docData },
      { data: srvData },
      { data: legacySrvData },
    ] = await Promise.all([
      apiClient
        .from('appointments')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('appointment_date', { ascending: false }),
      apiClient
        .from('patients')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('full_name', { ascending: true }),
      apiClient
        .from('doctors')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      apiClient
        .from('dental_services')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      apiClient
        .from('items')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('type', 'service')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);
    if (apptData) setAppointments(apptData as Appointment[]);
    if (ptData) setPatients(ptData as Patient[]);
    if (docData) setDoctors(docData as Doctor[]);
    
    const allServices: any[] = [];
    if (Array.isArray(srvData) && srvData.length > 0) {
      allServices.push(...srvData);
    }
    if (Array.isArray(legacySrvData) && legacySrvData.length > 0) {
      allServices.push(...legacySrvData);
    }
    setServices(allServices);
    setLoading(false);
  }, [currentStore?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Pre-fill patient or doctor if in URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('patient_id');
    const docId = params.get('doctor_id');
    const docName = params.get('doctor_name');

    if (pid && patients.length > 0) {
      const found = patients.find(p => p.id === pid);
      if (found) {
        setEditingAppt(null);
        setForm(prev => ({
          ...prev,
          patient_id: found.id,
          patient_name: found.full_name,
          patient_phone: found.phone || '',
          ...(docId ? { doctor_id: docId } : {}),
          ...(docName ? { doctor_name: docName } : {}),
        }));
        setShowModal(true);
        return;
      }
    }

    if (docId || docName) {
      setForm(prev => ({
        ...prev,
        doctor_id: docId || '',
        doctor_name: docName || prev.doctor_name,
      }));
      setShowModal(true);
    }
  }, [patients]);

  const handlePatientSelect = (patientId: string) => {
    const pt = patients.find(p => p.id === patientId);
    if (pt) {
      setForm(prev => ({
        ...prev,
        patient_id: pt.id,
        patient_name: pt.full_name,
        patient_phone: pt.phone || '',
      }));
    } else {
      setForm(prev => ({ ...prev, patient_id: '' }));
    }
  };

  const handleDoctorSelect = (doctorId: string) => {
    const doc = doctors.find(d => d.id === doctorId);
    if (doc) {
      setForm(prev => ({
        ...prev,
        doctor_id: doc.id,
        doctor_name: doc.name,
      }));
    } else {
      setForm(prev => ({ ...prev, doctor_id: '' }));
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    if (serviceId === 'custom') {
      setForm(prev => ({ ...prev, service_id: '' }));
      return;
    }
    const srv = services.find(s => s.id === serviceId);
    if (srv) {
      setForm(prev => ({
        ...prev,
        service_id: srv.id,
        reason: srv.name,
      }));
    } else {
      setForm(prev => ({ ...prev, service_id: '' }));
    }
  };

  const openBookModal = () => {
    setEditingAppt(null);
    const defaultDoctor = doctors[0];
    setForm({
      patient_id: '',
      patient_name: '',
      patient_phone: '',
      doctor_id: defaultDoctor ? defaultDoctor.id : '',
      doctor_name: defaultDoctor ? defaultDoctor.name : (user?.full_name || 'Dr. On Duty'),
      service_id: '',
      appointment_date: todayStr,
      appointment_time: '09:00',
      duration_minutes: '30',
      reason: COMMON_REASONS[0],
      status: 'scheduled',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (appt: Appointment) => {
    setEditingAppt(appt);
    setForm({
      patient_id: appt.patient_id || '',
      patient_name: appt.patient_name || '',
      patient_phone: appt.patient_phone || '',
      doctor_id: appt.doctor_id || '',
      doctor_name: appt.doctor_name || '',
      service_id: appt.service_id || '',
      appointment_date: String(appt.appointment_date || todayStr).split('T')[0],
      appointment_time: appt.appointment_time || '09:00',
      duration_minutes: String(appt.duration_minutes || 30),
      reason: appt.reason || COMMON_REASONS[0],
      status: appt.status || 'scheduled',
      notes: appt.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id) return;
    if (!form.patient_name.trim()) {
      toast.error('Please select or enter a patient name');
      return;
    }

    setSaving(true);
    const payload = {
      store_id: currentStore.id,
      patient_id: form.patient_id || null,
      patient_name: form.patient_name.trim(),
      patient_phone: form.patient_phone.trim(),
      doctor_id: form.doctor_id || null,
      doctor_name: form.doctor_name.trim(),
      service_id: form.service_id || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      duration_minutes: parseInt(form.duration_minutes, 10) || 30,
      reason: form.reason,
      status: form.status,
      notes: form.notes.trim(),
      created_by: user?.id || null,
    };

    if (editingAppt) {
      const { error } = await apiClient
        .from('appointments')
        .update(payload as any)
        .eq('id', editingAppt.id);
      if (error) {
        toast.error('Failed to update appointment');
      } else {
        toast.success('Appointment updated');
        setShowModal(false);
        loadData();
      }
    } else {
      const { error } = await apiClient
        .from('appointments')
        .insert(payload as any);
      if (error) {
        toast.error('Failed to schedule appointment');
      } else {
        toast.success('Appointment scheduled');
        setShowModal(false);
        loadData();
      }
    }
    setSaving(false);
  };

  const updateStatus = async (appt: Appointment, status: Appointment['status']) => {
    const { error } = await apiClient
      .from('appointments')
      .update({ status } as any)
      .eq('id', appt.id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Appointment marked as ${status.replace('_', ' ')}`);
      loadData();
    }
  };

  const deleteAppt = async (appt: Appointment) => {
    if (!confirm(`Delete appointment for "${appt.patient_name}"?`)) return;
    const { error } = await apiClient.from('appointments').delete().eq('id', appt.id);
    if (!error) {
      toast.success('Appointment deleted');
      loadData();
    }
  };

  const filtered = useMemo(() => {
    return appointments.filter(a => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.patient_name?.toLowerCase().includes(q) ||
        a.patient_phone?.toLowerCase().includes(q) ||
        a.doctor_name?.toLowerCase().includes(q) ||
        a.reason?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      const cleanDate = String(a.appointment_date || '').split('T')[0];
      const matchesDate = !dateFilter || cleanDate === dateFilter;
      const matchesDoctor =
        doctorFilter === 'all' ||
        a.doctor_id === doctorFilter ||
        a.doctor_name === doctorFilter;
      return matchesSearch && matchesStatus && matchesDate && matchesDoctor;
    });
  }, [appointments, search, statusFilter, dateFilter, doctorFilter]);

  const statusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
      case 'checked_in':
        return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
      case 'in_progress':
        return 'bg-purple-500/15 text-purple-500 border-purple-500/30';
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
      case 'cancelled':
        return 'bg-red-500/15 text-red-500 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const todayCount = appointments.filter(a => String(a.appointment_date || '').split('T')[0] === todayStr).length;
  const waitingCount = appointments.filter(a => a.status === 'checked_in' || a.status === 'in_progress').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Dental Appointments"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dental-doctors')}
              className="hidden sm:flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-3.5 py-2 rounded-md text-sm font-semibold border border-border shadow-sm transition-colors"
            >
              <UserCheck size={16} />
              <span>Doctors Directory</span>
            </button>
            <button
              onClick={openBookModal}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold shadow-sm hover:opacity-90"
            >
              <Plus size={16} />
              <span>Book Appointment</span>
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Today's Schedule</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{todayCount}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Calendar size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Checked-In / In Chair</p>
              <h3 className="text-2xl font-bold text-amber-500 mt-1">{waitingCount}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed Visits</p>
              <h3 className="text-2xl font-bold text-emerald-500 mt-1">{completedCount}</h3>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient, dentist, or procedure..."
              className="w-full pl-10 pr-4 h-10 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-3 h-10 rounded-lg bg-card border border-border text-sm text-foreground"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="px-2.5 h-10 rounded-lg bg-muted text-xs font-semibold text-foreground hover:bg-accent"
              >
                All Dates
              </button>
            )}
            <button
              onClick={() => setDateFilter(todayStr)}
              className={`px-3 h-10 rounded-lg text-xs font-bold border transition-colors ${
                dateFilter === todayStr
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              Today
            </button>
            <select
              value={doctorFilter}
              onChange={e => setDoctorFilter(e.target.value)}
              className="px-3 h-10 rounded-lg bg-card border border-border text-sm text-foreground"
            >
              <option value="all">All Doctors</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 h-10 rounded-lg bg-card border border-border text-sm text-foreground"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="checked_in">Checked In</option>
              <option value="in_progress">In Chair / Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Date & Time</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Patient</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Procedure / Reason</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Dentist</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Loading appointments...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      No appointments found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map(appt => (
                    <tr key={appt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="text-sm font-bold text-foreground">
                          {String(appt.appointment_date || '').split('T')[0]}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock size={11} /> {appt.appointment_time || '09:00'} ({appt.duration_minutes || 30}m)
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-sm font-bold text-foreground">{appt.patient_name}</div>
                        {appt.patient_phone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone size={11} /> {appt.patient_phone}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-sm font-medium text-foreground">{appt.reason || 'Consultation'}</div>
                        {appt.notes && <div className="text-xs text-muted-foreground truncate max-w-xs">{appt.notes}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-muted-foreground">
                        {appt.doctor_name || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${statusBadge(appt.status)}`}>
                          {appt.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {appt.status === 'scheduled' && (
                            <button
                              onClick={() => updateStatus(appt, 'checked_in')}
                              className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 text-xs font-bold"
                            >
                              Check In
                            </button>
                          )}
                          {appt.status === 'checked_in' && (
                            <button
                              onClick={() => updateStatus(appt, 'in_progress')}
                              className="px-2.5 py-1 rounded bg-purple-500/15 text-purple-500 hover:bg-purple-500/25 text-xs font-bold flex items-center gap-1"
                            >
                              <PlayCircle size={12} /> Start
                            </button>
                          )}
                          {(appt.status === 'checked_in' || appt.status === 'in_progress' || appt.status === 'scheduled') && (
                            <button
                              onClick={() => updateStatus(appt, 'completed')}
                              className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 text-xs font-bold"
                            >
                              Complete
                            </button>
                          )}
                          {appt.patient_id && (
                            <button
                              onClick={() => navigate(`/dental-charting?patient_id=${appt.patient_id}`)}
                              className="px-2 py-1 rounded bg-cyan-500/15 text-cyan-500 hover:bg-cyan-500/25 text-xs font-bold flex items-center gap-1"
                              title="Open Patient Dental Chart"
                            >
                              <HeartPulse size={12} /> Chart
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/dental-billing?patient_id=${appt.patient_id || ''}&appointment_id=${appt.id}`)}
                            className="px-2 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25 text-xs font-bold flex items-center gap-1"
                            title="Bill Patient"
                          >
                            <Stethoscope size={12} /> Bill
                          </button>
                          <button
                            onClick={() => openEditModal(appt)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit Appointment"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => deleteAppt(appt)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* Book / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-2xl border border-border max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
              <h2 className="text-lg font-bold text-foreground">
                {editingAppt ? 'Edit Dental Appointment' : 'Schedule Dental Appointment'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Select Registered Patient (Optional)
                </label>
                <select
                  value={form.patient_id}
                  onChange={e => handlePatientSelect(e.target.value)}
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                >
                  <option value="">— Walk-in / Enter Name Manually —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.phone ? `(${p.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Patient Name *</label>
                  <input
                    type="text"
                    value={form.patient_name}
                    onChange={e => setForm({ ...form, patient_name: e.target.value })}
                    placeholder="Patient full name"
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Patient Phone</label>
                  <input
                    type="text"
                    value={form.patient_phone}
                    onChange={e => setForm({ ...form, patient_phone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.appointment_date}
                    onChange={e => setForm({ ...form, appointment_date: e.target.value })}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Time *</label>
                  <input
                    type="time"
                    value={form.appointment_time}
                    onChange={e => setForm({ ...form, appointment_time: e.target.value })}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Duration</label>
                  <select
                    value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  >
                    <option value="15">15 mins</option>
                    <option value="30">30 mins</option>
                    <option value="45">45 mins</option>
                    <option value="60">60 mins</option>
                    <option value="90">90 mins</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Dentist / Doctor *
                  </label>
                  {doctors.length > 0 && (
                    <select
                      value={form.doctor_id}
                      onChange={e => handleDoctorSelect(e.target.value)}
                      className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground mb-1.5"
                    >
                      <option value="">— Select from Doctors Directory —</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.specialization || 'General Dentist'})
                        </option>
                      ))}
                      <option value="custom">Other / Custom Doctor Name...</option>
                    </select>
                  )}
                  {(!form.doctor_id || doctors.length === 0) && (
                    <input
                      type="text"
                      value={form.doctor_name}
                      onChange={e => setForm({ ...form, doctor_name: e.target.value })}
                      placeholder="Dr. Full Name"
                      className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as Appointment['status'] })}
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="checked_in">Checked In</option>
                    <option value="in_progress">In Chair / In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Procedure / Visit Reason *
                  </label>
                  {services.length > 0 && (
                    <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                      <Sparkles size={11} /> Dental Catalog
                    </span>
                  )}
                </div>
                {services.length > 0 && (
                  <select
                    value={form.service_id}
                    onChange={e => handleServiceSelect(e.target.value)}
                    className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground mb-1.5"
                  >
                    <option value="">— Select Predefined Clinical Procedure —</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.sell_price ? `(${formatCurrency(s.sell_price)})` : ''}
                      </option>
                    ))}
                    <option value="custom">Other / Custom Clinical Reason...</option>
                  </select>
                )}
                <input
                  type="text"
                  list="dental-reasons"
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="Select above or type procedure reason..."
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  required
                />
                <datalist id="dental-reasons">
                  {COMMON_REASONS.map(r => <option key={r} value={r} />)}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Appointment Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Tooth number, pain level, special instructions..."
                  className="w-full p-3 rounded-lg border border-input bg-background text-sm text-foreground"
                />
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
                  {saving ? 'Saving...' : editingAppt ? 'Save Changes' : 'Schedule Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

