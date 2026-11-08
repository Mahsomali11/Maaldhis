import { useState, useEffect, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import type { Patient, DentalChartEntry } from '@/types';
import { toast } from 'sonner';
import {
  HeartPulse, User, Search, Plus, Save, RotateCcw, AlertTriangle,
  CheckCircle2, FileText, ArrowRight, Stethoscope, Printer, X, ShieldAlert
} from 'lucide-react';

// Adult Dentition (Universal Numbering 1 to 32)
// Upper: 1-16 (Upper Right 1-8, Upper Left 9-16)
// Lower: 32-17 (Lower Right 32-25, Lower Left 24-17)
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

export default function DentalChartingPage() {
  const { currentStore, user } = useApp();
  const navigate = (url: string) => router.visit(url);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [chartEntries, setChartEntries] = useState<Record<number, DentalChartEntry>>({});
  const [loading, setLoading] = useState(false);
  const [activeTooth, setActiveTooth] = useState<ToothDef | null>(null);
  const [savingTooth, setSavingTooth] = useState(false);

  // Form for selected tooth
  const [toothForm, setToothForm] = useState({
    condition_status: 'healthy' as DentalChartEntry['condition_status'],
    surface: '',
    diagnosis: '',
    treatment_plan: '',
    notes: '',
  });

  // Load patients list on mount
  useEffect(() => {
    if (!currentStore?.id) return;
    (async () => {
      const { data } = await apiClient
        .from('patients')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('full_name', { ascending: true });
      if (data && data.length > 0) {
        setPatients(data as Patient[]);
        // Check query param ?patient_id=
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const queryPid = urlParams?.get('patient_id');
        const defaultPt = queryPid ? data.find(p => p.id === queryPid) || data[0] : data[0];
        setSelectedPatientId(defaultPt.id);
        setSelectedPatient(defaultPt);
      }
    })();
  }, [currentStore?.id]);

  // Load patient's chart entries when selected patient changes
  const loadChart = useCallback(async (patientId: string) => {
    if (!currentStore?.id || !patientId) return;
    setLoading(true);
    const { data } = await apiClient
      .from('dental_charts')
      .select('*')
      .eq('store_id', currentStore.id)
      .eq('patient_id', patientId);

    const map: Record<number, DentalChartEntry> = {};
    if (data) {
      data.forEach((entry: any) => {
        map[entry.tooth_number] = entry as DentalChartEntry;
      });
    }
    setChartEntries(map);
    setLoading(false);
  }, [currentStore?.id]);

  useEffect(() => {
    if (selectedPatientId) {
      const pt = patients.find(p => p.id === selectedPatientId) || null;
      setSelectedPatient(pt);
      loadChart(selectedPatientId);
    }
  }, [selectedPatientId, patients, loadChart]);

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

  const saveToothDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id || !selectedPatientId || !activeTooth) return;

    setSavingTooth(true);
    const existing = chartEntries[activeTooth.num];
    const payload = {
      store_id: currentStore.id,
      patient_id: selectedPatientId,
      tooth_number: activeTooth.num,
      tooth_name: activeTooth.name,
      condition_status: toothForm.condition_status,
      surface: toothForm.surface.trim(),
      diagnosis: toothForm.diagnosis.trim(),
      treatment_plan: toothForm.treatment_plan.trim(),
      notes: toothForm.notes.trim(),
      updated_by: user?.id || null,
    };

    if (existing) {
      const { error } = await apiClient
        .from('dental_charts')
        .update(payload as any)
        .eq('id', existing.id);
      if (error) {
        toast.error('Failed to update tooth diagnosis');
      } else {
        toast.success(`Tooth #${activeTooth.num} (${activeTooth.fdi}) updated`);
        setActiveTooth(null);
        loadChart(selectedPatientId);
      }
    } else {
      const { error } = await apiClient
        .from('dental_charts')
        .insert(payload as any);
      if (error) {
        toast.error('Failed to record tooth diagnosis');
      } else {
        toast.success(`Tooth #${activeTooth.num} (${activeTooth.fdi}) recorded`);
        setActiveTooth(null);
        loadChart(selectedPatientId);
      }
    }
    setSavingTooth(false);
  };

  // Quick action: jump straight to Treatment Billing with prefilled tooth & plan
  const createTreatmentBillFromTooth = () => {
    if (!selectedPatientId || !activeTooth) return;
    const proc = toothForm.treatment_plan || toothForm.diagnosis || 'Tooth Procedure';
    navigate(`/dental-billing?patient_id=${selectedPatientId}&tooth=${activeTooth.num}&procedure=${encodeURIComponent(proc)}`);
  };

  // Computed summary metrics
  const stats = useMemo(() => {
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

    const treatedOrNoted = Object.keys(chartEntries).length;
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
      treatedOrNoted,
    };
  }, [chartEntries]);

  // Tooth arch groups
  const upperRightTeeth = TOOTH_DEFINITIONS.filter(t => t.quadrant === 'UR');
  const upperLeftTeeth = TOOTH_DEFINITIONS.filter(t => t.quadrant === 'UL');
  const lowerLeftTeeth = TOOTH_DEFINITIONS.filter(t => t.quadrant === 'LL');
  const lowerRightTeeth = TOOTH_DEFINITIONS.filter(t => t.quadrant === 'LR');

  const renderToothCell = (tooth: ToothDef) => {
    const entry = chartEntries[tooth.num];
    const status: DentalChartEntry['condition_status'] = entry?.condition_status || 'healthy';
    const style = CONDITION_STYLES[status];

    return (
      <button
        key={tooth.num}
        onClick={() => openToothModal(tooth)}
        title={`#${tooth.num} (FDI ${tooth.fdi}): ${tooth.name} - ${style.label}`}
        className={`flex flex-col items-center justify-between p-2 rounded-xl border transition-all text-center relative group min-w-[56px] max-w-[70px] flex-1 hover:scale-105 shadow-sm ${style.bg} ${style.border}`}
      >
        <span className="text-[10px] font-mono font-bold text-muted-foreground group-hover:text-foreground">
          #{tooth.num}
        </span>

        {/* Anatomical Tooth Visual Box */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center my-1 font-bold text-xs shadow-inner border border-white/10">
          <span className={style.text}>
            {status === 'missing' ? '✕' : status === 'root_canal' ? 'RCT' : status === 'implant' ? 'IMP' : tooth.fdi}
          </span>
        </div>

        <span className={`text-[9px] font-bold uppercase truncate max-w-full ${style.text}`}>
          {style.label.split(' ')[0]}
        </span>

        {entry?.treatment_plan && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-500 ring-2 ring-background" title="Treatment Planned" />
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Interactive Dental Odontogram & Charting"
        rightAction={
          selectedPatient && (
            <button
              onClick={() => navigate(`/dental-billing?patient_id=${selectedPatient.id}`)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold shadow-sm hover:opacity-90"
            >
              <Stethoscope size={16} />
              <span>Bill Treatments</span>
            </button>
          )
        }
      />

      <div className="p-4 sm:p-6 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* Patient Selection Bar */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
              <User size={20} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Active Dental Patient
              </label>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {patients.length === 0 && <option value="">No registered patients yet</option>}
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.patient_code ? `[${p.patient_code}] ` : ''}{p.full_name} {p.phone ? `(${p.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPatient && (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="bg-muted/40 px-3 py-2 rounded-lg border border-border">
                <span className="text-muted-foreground">Age / Gender:</span>{' '}
                <span className="font-bold text-foreground">{selectedPatient.gender || '—'} {selectedPatient.age != null ? `(${selectedPatient.age} yrs)` : ''}</span>
              </div>
              <div className="bg-muted/40 px-3 py-2 rounded-lg border border-border">
                <span className="text-muted-foreground">Blood:</span>{' '}
                <span className="font-bold text-foreground">{selectedPatient.blood_group || '—'}</span>
              </div>
              {selectedPatient.allergies ? (
                <div className="bg-red-500/15 border border-red-500/30 px-3 py-2 rounded-lg text-red-500 font-bold flex items-center gap-1.5">
                  <ShieldAlert size={14} /> {selectedPatient.allergies}
                </div>
              ) : (
                <div className="bg-emerald-500/10 text-emerald-500 px-3 py-2 rounded-lg font-medium">
                  No known allergies
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend / Status Badges */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tooth Condition Legend</span>
            <span className="text-xs text-muted-foreground">Click any tooth below to edit diagnosis or add procedure</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(CONDITION_STYLES).map(([key, item]) => (
              <div key={key} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${item.bg} ${item.text} ${item.border}`}>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Odontogram Visual Chart (Universal 1 to 32 & FDI) */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-8">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <HeartPulse size={18} className="text-cyan-500" />
              <h2 className="text-base font-bold text-foreground">Adult Odontogram Chart (Universal 1–32 / FDI)</h2>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Maxillary (Upper) & Mandibular (Lower) Arches
            </span>
          </div>

          {/* Upper Arch (Maxillary) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-2">
              <span>MAXILLARY ARCH (UPPER JAW)</span>
              <span>PATIENT RIGHT ➔ PATIENT LEFT</span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-8 bg-muted/20 p-4 rounded-2xl border border-border">
              {/* Upper Right Quadrant (Teeth 1 to 8) */}
              <div>
                <div className="text-[10px] font-bold text-muted-foreground text-center mb-2 uppercase tracking-wider">
                  Upper Right (UR 18–11)
                </div>
                <div className="flex gap-1.5 justify-end flex-wrap sm:flex-nowrap">
                  {upperRightTeeth.map(renderToothCell)}
                </div>
              </div>

              {/* Upper Left Quadrant (Teeth 9 to 16) */}
              <div>
                <div className="text-[10px] font-bold text-muted-foreground text-center mb-2 uppercase tracking-wider">
                  Upper Left (UL 21–28)
                </div>
                <div className="flex gap-1.5 justify-start flex-wrap sm:flex-nowrap">
                  {upperLeftTeeth.map(renderToothCell)}
                </div>
              </div>
            </div>
          </div>

          {/* Midline Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-dashed border-border w-full"></div>
            <span className="bg-card px-4 text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest absolute">
              OCCLUSAL PLANE / MIDLINE
            </span>
          </div>

          {/* Lower Arch (Mandibular) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-2">
              <span>MANDIBULAR ARCH (LOWER JAW)</span>
              <span>PATIENT RIGHT ➔ PATIENT LEFT</span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-8 bg-muted/20 p-4 rounded-2xl border border-border">
              {/* Lower Right Quadrant (Teeth 32 down to 25) */}
              <div>
                <div className="text-[10px] font-bold text-muted-foreground text-center mb-2 uppercase tracking-wider">
                  Lower Right (LR 48–41)
                </div>
                <div className="flex gap-1.5 justify-end flex-wrap sm:flex-nowrap">
                  {lowerRightTeeth.slice().reverse().map(renderToothCell)}
                </div>
              </div>

              {/* Lower Left Quadrant (Teeth 24 down to 17) */}
              <div>
                <div className="text-[10px] font-bold text-muted-foreground text-center mb-2 uppercase tracking-wider">
                  Lower Left (LL 31–38)
                </div>
                <div className="flex gap-1.5 justify-start flex-wrap sm:flex-nowrap">
                  {lowerLeftTeeth.map(renderToothCell)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Summary & Treatment Planning Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" /> Arch Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Healthy Teeth</span>
                <span className="font-bold text-emerald-500">{stats.healthyCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Decayed / Caries</span>
                <span className="font-bold text-rose-500">{stats.cariesCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Restored / Filled</span>
                <span className="font-bold text-blue-500">{stats.filledCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Root Canals (RCT)</span>
                <span className="font-bold text-purple-500">{stats.rctCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Extraction Needed</span>
                <span className="font-bold text-orange-500">{stats.extractionCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Missing / Extracted</span>
                <span className="font-bold text-muted-foreground">{stats.missingCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Stethoscope size={16} className="text-primary" /> Active Treatment Plans & Diagnosis Records
              </h3>
              {selectedPatient && (
                <button
                  onClick={() => navigate(`/dental-billing?patient_id=${selectedPatient.id}`)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  Create Invoice <ArrowRight size={13} />
                </button>
              )}
            </div>

            {Object.keys(chartEntries).length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                All 32 teeth are currently healthy. Click any tooth on the odontogram to record decay, restorations, or procedure plans.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {Object.values(chartEntries).map(entry => {
                  const style = CONDITION_STYLES[entry.condition_status];
                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg border border-border bg-muted/20 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-foreground text-sm">
                            Tooth #{entry.tooth_number} {entry.tooth_name ? `(${entry.tooth_name})` : ''}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                            {style.label}
                          </span>
                          {entry.surface && (
                            <span className="text-muted-foreground font-mono">Surface: {entry.surface}</span>
                          )}
                        </div>
                        {entry.diagnosis && (
                          <p className="text-foreground">
                            <span className="text-muted-foreground font-semibold">Diagnosis:</span> {entry.diagnosis}
                          </p>
                        )}
                        {entry.treatment_plan && (
                          <p className="text-cyan-500 font-medium mt-0.5">
                            <span className="text-muted-foreground font-semibold">Plan:</span> {entry.treatment_plan}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const toothDef = TOOTH_DEFINITIONS.find(t => t.num === entry.tooth_number);
                          if (toothDef) openToothModal(toothDef);
                        }}
                        className="px-2.5 py-1 rounded bg-muted hover:bg-accent text-foreground font-semibold shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tooth Diagnosis & Treatment Modal */}
      {activeTooth && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveTooth(null)}>
          <div className="bg-card rounded-2xl border border-border max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-border pb-4 mb-5">
              <div>
                <span className="text-xs font-mono text-cyan-500 font-bold">
                  UNIVERSAL #{activeTooth.num} · FDI {activeTooth.fdi} · {activeTooth.quadrant} QUADRANT
                </span>
                <h2 className="text-lg font-bold text-foreground mt-0.5">{activeTooth.name}</h2>
              </div>
              <button onClick={() => setActiveTooth(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveToothDiagnosis} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Tooth Condition Status *
                </label>
                <select
                  value={toothForm.condition_status}
                  onChange={e => setToothForm({ ...toothForm, condition_status: e.target.value as DentalChartEntry['condition_status'] })}
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm font-semibold text-foreground"
                >
                  {Object.entries(CONDITION_STYLES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Surface Involved (Optional: O, M, D, B, L)
                </label>
                <input
                  type="text"
                  value={toothForm.surface}
                  onChange={e => setToothForm({ ...toothForm, surface: e.target.value.toUpperCase() })}
                  placeholder="e.g. MOD (Mesial-Occlusal-Distal)"
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground uppercase font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Clinical Diagnosis
                </label>
                <input
                  type="text"
                  value={toothForm.diagnosis}
                  onChange={e => setToothForm({ ...toothForm, diagnosis: e.target.value })}
                  placeholder="e.g. Deep dentin caries, irreversible pulpitis, chipped cusp..."
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-cyan-500 uppercase tracking-wider block mb-1">
                  Recommended Treatment Plan
                </label>
                <input
                  type="text"
                  value={toothForm.treatment_plan}
                  onChange={e => setToothForm({ ...toothForm, treatment_plan: e.target.value })}
                  placeholder="e.g. Composite Restoration, Root Canal + PFM Crown, Extraction"
                  className="w-full px-3.5 h-10 rounded-lg border border-cyan-500/30 bg-background text-sm text-foreground font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Tooth Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={toothForm.notes}
                  onChange={e => setToothForm({ ...toothForm, notes: e.target.value })}
                  placeholder="Additional notes for patient chart..."
                  className="w-full p-3 rounded-lg border border-input bg-background text-sm text-foreground"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
                {toothForm.treatment_plan ? (
                  <button
                    type="button"
                    onClick={createTreatmentBillFromTooth}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-cyan-700"
                  >
                    <Stethoscope size={14} /> Bill This Plan
                  </button>
                ) : <div />}

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveTooth(null)}
                    className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTooth}
                    className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {savingTooth ? 'Saving...' : 'Save Diagnosis'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

