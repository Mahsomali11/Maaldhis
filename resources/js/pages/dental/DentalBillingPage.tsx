import { useState, useEffect, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import type { DentalTreatment, Patient, Item, TreatmentLineItem } from '@/types';
import { toast } from 'sonner';
import {
  Stethoscope, Plus, Search, DollarSign, Receipt, Printer, CheckCircle2,
  AlertCircle, Clock, User, FileText, X, CreditCard, ChevronRight, Filter,
  Package, Trash2, AlertTriangle, Layers, Tag, Check, Sparkles, Wallet
} from 'lucide-react';

const PROCEDURE_CATEGORIES = [
  'Consultation & Checkup',
  'Scaling & Cleaning (Prophylaxis)',
  'Restorative & Fillings',
  'Endodontics (Root Canal)',
  'Oral Surgery & Extractions',
  'Prosthodontics (Crowns & Bridges)',
  'Orthodontics & Braces',
  'Cosmetic & Teeth Whitening',
  'Periodontal Care',
  'Pediatric Dentistry',
  'X-Ray & Diagnostic Imaging',
  'Other Clinical Procedure',
];

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Card', 'Insurance'];

function getMatchingAccountId(method: string, accounts: any[]): string {
  if (!accounts || accounts.length === 0) return '';
  const m = (method || '').toLowerCase();
  if (m.includes('mobile') || m.includes('evc')) {
    const matched = accounts.find((a: any) =>
      a.account_type === 'Mobile Money' ||
      a.account_name?.toLowerCase().includes('evc') ||
      a.account_name?.toLowerCase().includes('mobile')
    );
    if (matched) return matched.id;
  } else if (m.includes('cash')) {
    const matched = accounts.find((a: any) =>
      a.account_type === 'Cash' || a.account_name?.toLowerCase().includes('cash')
    );
    if (matched) return matched.id;
  } else if (m.includes('bank')) {
    const matched = accounts.find((a: any) => a.account_type === 'Bank');
    if (matched) return matched.id;
  } else if (m.includes('card')) {
    const matched = accounts.find((a: any) => a.account_type === 'Card');
    if (matched) return matched.id;
  }
  return accounts[0]?.id || '';
}

function parseItemsDetail(detail: any): TreatmentLineItem[] {
  if (!detail) return [];
  if (Array.isArray(detail)) return detail;
  if (typeof detail === 'string') {
    try {
      const parsed = JSON.parse(detail);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      return [];
    }
  }
  return [];
}

function paymentStatusBadge(status?: DentalTreatment['payment_status']): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
    case 'partial':
      return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
    case 'unpaid':
      return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export default function DentalBillingPage() {
  const { currentStore, formatCurrency, user, refreshData } = useApp();
  const navigate = (url: string) => router.visit(url);

  const isDentalClinic = currentStore?.business_type === 'dental_clinic';

  const [treatments, setTreatments] = useState<DentalTreatment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  const [showModal, setShowModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState<DentalTreatment | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<DentalTreatment | null>(null);
  const [saving, setSaving] = useState(false);

  // Collect balance state
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('Cash');
  const [collectAccountId, setCollectAccountId] = useState('');

  // New Invoice Form
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    tooth_numbers: '',
    procedure_name: '',
    category: PROCEDURE_CATEGORIES[0],
    doctor_name: user?.full_name || 'Dr. On Duty',
    diagnosis: '',
    prescription: '',
    discount: '0',
    paid_amount: '0',
    payment_method: 'Cash',
    payment_account_id: '',
    notes: '',
  });

  // Dual-Catalog Line Items State
  const [lineItems, setLineItems] = useState<TreatmentLineItem[]>([]);

  // Split catalog into Clinical Services (non-inventory) and Physical Items (inventory)
  const catalogServices = useMemo(() => {
    return catalogItems.filter(i => i.type === 'service' || i.is_service === true);
  }, [catalogItems]);

  const catalogProducts = useMemo(() => {
    return catalogItems.filter(i => i.type === 'product' && !i.is_service);
  }, [catalogItems]);

  const loadData = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    const [
      { data: trData },
      { data: ptData },
      { data: accData },
      { data: srvData },
      { data: itmData },
      { data: itemData },
    ] = await Promise.all([
      apiClient
        .from('treatments')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('created_at', { ascending: false }),
      apiClient
        .from('patients')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('full_name', { ascending: true }),
      apiClient
        .from('payment_accounts')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('is_active', true),
      apiClient
        .from('dental_services')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      apiClient
        .from('dental_items')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      apiClient
        .from('items')
        .select('*')
        .eq('store_id', currentStore.id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);

    if (trData) setTreatments(trData as DentalTreatment[]);
    if (ptData) setPatients(ptData as Patient[]);
    if (accData) {
      setPaymentAccounts(accData || []);
      setForm(prev => {
        if (!prev.payment_account_id) {
          const matched = getMatchingAccountId(prev.payment_method, accData || []);
          return { ...prev, payment_account_id: matched };
        }
        return prev;
      });
    }

    const combined: Item[] = [];
    if (Array.isArray(srvData)) {
      combined.push(
        ...srvData.map((s: any) => ({
          ...s,
          item_code: s.code || '',
          sell_price: Number(s.price || 0),
          retail_price: Number(s.price || 0),
          type: 'service',
          is_service: true,
        }))
      );
    }
    if (Array.isArray(itmData)) {
      combined.push(
        ...itmData.map((i: any) => ({
          ...i,
          item_code: i.code || '',
          sell_price: Number(i.retail_price || 0),
          quantity: Number(i.stock_quantity || 0),
          low_stock_threshold: Number(i.reorder_level || 5),
          type: 'product',
          is_service: false,
        }))
      );
    }
    if (Array.isArray(itemData) && itemData.length > 0) {
      combined.push(...(itemData as Item[]));
    }
    setCatalogItems(combined);
    setLoading(false);
  }, [currentStore?.id]);

  const handlePaymentMethodChange = (newMethod: string) => {
    const matchedAccId = getMatchingAccountId(newMethod, paymentAccounts);
    setForm(prev => ({
      ...prev,
      payment_method: newMethod,
      payment_account_id: matchedAccId || prev.payment_account_id,
    }));
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle URL query parameters (e.g. from Charting, Patients, Appointments, or Dental Catalog)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('patient_id');
    const tooth = params.get('tooth');
    const proc = params.get('procedure');

    if (pid || tooth || proc) {
      const pt = patients.find(p => p.id === pid);
      setForm(prev => ({
        ...prev,
        patient_id: pid || prev.patient_id,
        patient_name: pt?.full_name || prev.patient_name,
        doctor_name: user?.full_name || prev.doctor_name || 'Dr. On Duty',
        tooth_numbers: tooth ? `#${tooth.replace(/^#+/, '')}` : prev.tooth_numbers,
      }));

      if (proc) {
        const matchSvc = catalogServices.find(s => s.name.toLowerCase() === proc.toLowerCase());
        const fee = matchSvc ? Number(matchSvc.sell_price || matchSvc.retail_price || 0) : 0;
        setLineItems([{
          id: `line_init_${Date.now()}`,
          type: 'service',
          item_id: matchSvc?.id,
          name: proc,
          category: matchSvc?.category || 'Clinical Procedure',
          tooth_number: tooth ? `#${tooth.replace(/^#+/, '')}` : '',
          unit_price: fee,
          quantity: 1,
          total: fee,
        }]);
      } else if (lineItems.length === 0) {
        // Default with 1 service line item
        const defaultSvc = catalogServices[0];
        const defaultFee = defaultSvc ? Number(defaultSvc.sell_price || defaultSvc.retail_price || 0) : 0;
        setLineItems([{
          id: `line_init_${Date.now()}`,
          type: 'service',
          item_id: defaultSvc?.id,
          name: defaultSvc?.name || 'Clinical Consultation',
          category: defaultSvc?.category || 'Consultation & Checkup',
          tooth_number: tooth ? `#${tooth.replace(/^#+/, '')}` : '',
          unit_price: defaultFee,
          quantity: 1,
          total: defaultFee,
        }]);
      }
      setShowModal(true);
    }
  }, [patients, catalogServices, user?.full_name]);

  const handlePatientSelect = (pid: string) => {
    const pt = patients.find(p => p.id === pid);
    if (pt) {
      setForm(prev => ({
        ...prev,
        patient_id: pt.id,
        patient_name: pt.full_name,
      }));
    } else {
      setForm(prev => ({ ...prev, patient_id: '' }));
    }
  };

  const openNewInvoiceModal = () => {
    const initialAccId = getMatchingAccountId('Cash', paymentAccounts);
    setForm({
      patient_id: '',
      patient_name: '',
      tooth_numbers: '',
      procedure_name: '',
      category: PROCEDURE_CATEGORIES[0],
      doctor_name: user?.full_name || 'Dr. On Duty',
      diagnosis: '',
      prescription: '',
      discount: '0',
      paid_amount: '0',
      payment_method: 'Cash',
      payment_account_id: initialAccId,
      notes: '',
    });

    // Populate initial row with first catalog service if available
    const firstSvc = catalogServices[0];
    const initialFee = firstSvc ? Number(firstSvc.sell_price || firstSvc.retail_price || 0) : 0;
    setLineItems([{
      id: `line_svc_${Date.now()}`,
      type: 'service',
      item_id: firstSvc?.id,
      name: firstSvc?.name || '',
      category: firstSvc?.category || 'Consultation & Checkup',
      tooth_number: '',
      unit_price: initialFee,
      quantity: 1,
      total: initialFee,
    }]);

    setShowModal(true);
  };

  // --- Line Items Handlers ---
  const handleAddServiceLine = (serviceId?: string) => {
    const svc = serviceId ? catalogServices.find(s => s.id === serviceId) : catalogServices[0];
    const fee = svc ? Number(svc.sell_price || svc.retail_price || 0) : 0;
    const newLine: TreatmentLineItem = {
      id: `line_svc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'service',
      item_id: svc?.id,
      name: svc?.name || '',
      category: svc?.category || 'Clinical Procedure',
      tooth_number: '',
      unit_price: fee,
      quantity: 1,
      total: fee,
    };
    setLineItems(prev => [...prev, newLine]);
  };

  const handleAddProductLine = (productId?: string) => {
    const prd = productId ? catalogProducts.find(p => p.id === productId) : catalogProducts[0];
    const price = prd ? Number(prd.sell_price || prd.retail_price || 0) : 0;
    const stock = prd ? Number(prd.quantity || 0) : 0;
    const newLine: TreatmentLineItem = {
      id: `line_prd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'product',
      item_id: prd?.id,
      name: prd?.name || '',
      category: prd?.category || 'Dental Consumable',
      unit_price: price,
      quantity: 1,
      total: price,
      current_stock: stock,
    };
    setLineItems(prev => [...prev, newLine]);
  };

  const handleUpdateLineItem = (id: string, updates: Partial<TreatmentLineItem>) => {
    setLineItems(prev =>
      prev.map(line => {
        if (line.id !== id) return line;
        const updated = { ...line, ...updates };

        // If item_id changed: auto-populate name, unit price, stock
        if ('item_id' in updates && updates.item_id) {
          if (updated.type === 'service') {
            const svc = catalogServices.find(s => s.id === updates.item_id);
            if (svc) {
              updated.name = svc.name;
              updated.category = svc.category || updated.category;
              updated.unit_price = Number(svc.sell_price || svc.retail_price || 0);
            }
          } else {
            const prd = catalogProducts.find(p => p.id === updates.item_id);
            if (prd) {
              updated.name = prd.name;
              updated.category = prd.category || updated.category;
              updated.unit_price = Number(prd.sell_price || prd.retail_price || 0);
              updated.current_stock = Number(prd.quantity || 0);
            }
          }
        }

        // Recompute line total
        const qty = Number(updated.quantity) || 0;
        const price = Number(updated.unit_price) || 0;
        updated.total = Math.round(qty * price * 100) / 100;

        return updated;
      })
    );
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(prev => prev.filter(l => l.id !== id));
  };

  // --- Dynamic Financial Calculations ---
  const subtotalServices = useMemo(() => {
    return lineItems
      .filter(l => l.type === 'service')
      .reduce((sum, l) => sum + (Number(l.total) || 0), 0);
  }, [lineItems]);

  const subtotalProducts = useMemo(() => {
    return lineItems
      .filter(l => l.type === 'product')
      .reduce((sum, l) => sum + (Number(l.total) || 0), 0);
  }, [lineItems]);

  const grossTotal = subtotalServices + subtotalProducts;
  const discountNum = Math.max(0, parseFloat(form.discount) || 0);
  const netTotal = Math.max(0, grossTotal - discountNum);
  const paidNum = Math.min(netTotal, Math.max(0, parseFloat(form.paid_amount) || 0));
  const balanceNum = Math.max(0, netTotal - paidNum);

  // --- Invoice Creation Handler ---
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id) return;

    if (!form.patient_name.trim()) {
      toast.error('Patient name is required');
      return;
    }

    if (lineItems.length === 0) {
      toast.error('Please add at least one clinical service or physical item');
      return;
    }

    // Validate line items
    for (const line of lineItems) {
      if (!line.name?.trim()) {
        toast.error('Please enter or select a procedure / item name for all lines');
        return;
      }
      if ((Number(line.quantity) || 0) <= 0) {
        toast.error(`Quantity for "${line.name}" must be greater than zero`);
        return;
      }
      if (line.type === 'product' && line.item_id && line.current_stock !== undefined) {
        if (line.quantity > line.current_stock) {
          toast.error(`Quantity for "${line.name}" exceeds available stock (${line.current_stock} in stock)`);
          return;
        }
      }
    }

    if (netTotal <= 0 && grossTotal <= 0) {
      toast.error('Invoice total amount must be greater than zero');
      return;
    }

    setSaving(true);
    const invoiceNo = `DEN-${new Date().getFullYear()}-${String(treatments.length + 1).padStart(4, '0')}`;
    const paymentStatus = balanceNum === 0 ? 'paid' : paidNum > 0 ? 'partial' : 'unpaid';

    // Build procedure summary and tooth numbers
    const serviceLines = lineItems.filter(l => l.type === 'service');
    const productLines = lineItems.filter(l => l.type === 'product');

    const procedureSummary = serviceLines.length > 0
      ? serviceLines.map(s => s.name).join(', ')
      : productLines.map(p => p.name).join(', ');

    const primaryCategory = serviceLines[0]?.category || productLines[0]?.category || form.category || 'Clinical Procedure';
    const allToothNumbers = serviceLines
      .map(s => s.tooth_number?.trim())
      .filter(Boolean)
      .join(', ');

    const selectedAccountId = form.payment_account_id || getMatchingAccountId(form.payment_method, paymentAccounts) || null;

    const payload = {
      store_id: currentStore.id,
      patient_id: form.patient_id || null,
      patient_name: form.patient_name.trim(),
      invoice_no: invoiceNo,
      tooth_numbers: allToothNumbers || form.tooth_numbers.trim() || null,
      procedure_name: procedureSummary || 'Dental Treatment',
      category: primaryCategory,
      diagnosis: form.diagnosis.trim() || null,
      prescription: form.prescription.trim() || null,
      doctor_name: form.doctor_name.trim() || null,
      cost: grossTotal,
      discount: discountNum,
      total_amount: netTotal,
      paid_amount: paidNum,
      balance_amount: balanceNum,
      payment_status: paymentStatus,
      payment_method: form.payment_method,
      payment_account_id: selectedAccountId,
      status: 'completed',
      items_detail: lineItems,
      notes: form.notes.trim() || null,
      performed_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      created_by: user?.id || null,
    };

    const { data: createdTreatment, error } = await apiClient
      .from('treatments')
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      toast.error('Failed to create dental invoice: ' + (error.message || ''));
      setSaving(false);
      return;
    }

    // Stock Decrement strictly for physical Dental Items (Services NEVER decrement stock)
    const physicalItemsToDecrement = lineItems.filter(l => l.type === 'product' && l.item_id);
    if (physicalItemsToDecrement.length > 0) {
      try {
        await Promise.all(
          physicalItemsToDecrement.map(async (l) => {
            const prd = catalogProducts.find(p => p.id === l.item_id);
            if (prd) {
              const currentStock = Number(prd.stock_quantity ?? prd.quantity ?? 0);
              const nextQty = Math.max(0, currentStock - Number(l.quantity || 1));
              // Decrement from dental_items
              await apiClient
                .from('dental_items')
                .update({ stock_quantity: nextQty } as any)
                .eq('id', l.item_id);
              // Also update items table if item originated there
              await apiClient
                .from('items')
                .update({ quantity: nextQty } as any)
                .eq('id', l.item_id);
            }
          })
        );
      } catch (stockErr) {
        console.error('Failed to update stock quantity:', stockErr);
      }
    }

    // Record payment in payments table for Cash Flow & Payment Accounts (Ledger)
    if (paidNum > 0) {
      try {
        const paymentPayload = {
          store_id: currentStore.id,
          amount: paidNum,
          method: form.payment_method.toLowerCase(),
          payment_account_id: selectedAccountId,
          payment_type: 'dental_invoice',
          direction: 'in',
          reference: invoiceNo,
          created_by: user?.id,
        };
        const { error: pErr } = await apiClient.from('payments').insert(paymentPayload as any);
        if (pErr) {
          console.error('Failed to log payment to ledger:', pErr);
        }
      } catch (pe) {
        console.error('Failed to insert dental payment record:', pe);
      }
    }

    toast.success(`Dental invoice ${invoiceNo} generated successfully!`);
    setShowModal(false);
    loadData();
    refreshData().catch(console.warn);
    if (createdTreatment) {
      setShowPrintModal(createdTreatment as DentalTreatment);
    }
    setSaving(false);
  };

  // --- Collect Balance Handler ---
  const handleCollectBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCollectModal || !currentStore?.id) return;
    const addPaid = parseFloat(collectAmount) || 0;
    if (addPaid <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (addPaid > showCollectModal.balance_amount) {
      toast.error(`Amount exceeds outstanding balance (${formatCurrency(showCollectModal.balance_amount)})`);
      return;
    }

    setSaving(true);
    const newPaid = showCollectModal.paid_amount + addPaid;
    const newBalance = Math.max(0, showCollectModal.total_amount - newPaid);
    const newStatus = newBalance === 0 ? 'paid' : 'partial';

    const selectedAccId = collectAccountId || showCollectModal.payment_account_id || getMatchingAccountId(collectMethod, paymentAccounts) || null;

    const { error } = await apiClient
      .from('treatments')
      .update({
        paid_amount: newPaid,
        balance_amount: newBalance,
        payment_status: newStatus,
        payment_account_id: selectedAccId,
      } as any)
      .eq('id', showCollectModal.id);

    if (error) {
      toast.error('Failed to update balance');
    } else {
      // Record payment into payments table
      try {
        const paymentPayload = {
          store_id: currentStore.id,
          amount: addPaid,
          method: collectMethod.toLowerCase(),
          payment_account_id: selectedAccId,
          payment_type: 'dental_invoice',
          direction: 'in',
          reference: showCollectModal.invoice_no,
          created_by: user?.id,
        };
        const { error: pErr } = await apiClient.from('payments').insert(paymentPayload as any);
        if (pErr) console.error('Failed to log collect balance payment:', pErr);
      } catch (pe) {
        console.error('Failed to insert balance payment:', pe);
      }

      toast.success(`Payment of ${formatCurrency(addPaid)} recorded`);
      setShowCollectModal(null);
      setCollectAmount('');
      loadData();
      refreshData().catch(console.warn);
    }
    setSaving(false);
  };

  // --- Summary Metrics ---
  const summary = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let todayCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    treatments.forEach(t => {
      totalInvoiced += Number(t.total_amount || 0);
      totalCollected += Number(t.paid_amount || 0);
      totalOutstanding += Number(t.balance_amount || 0);
      if (String(t.created_at || '').split('T')[0] === todayStr) {
        todayCount++;
      }
    });

    return { totalInvoiced, totalCollected, totalOutstanding, todayCount };
  }, [treatments]);

  // --- Filtered treatment records ---
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return treatments.filter(t => {
      const matchesSearch =
        !q ||
        t.invoice_no?.toLowerCase().includes(q) ||
        t.patient_name?.toLowerCase().includes(q) ||
        t.procedure_name?.toLowerCase().includes(q) ||
        t.doctor_name?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || t.payment_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [treatments, search, statusFilter]);

  if (currentStore && currentStore.business_type !== 'dental_clinic') {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Dental Treatment Billing & Invoices" />
        <div className="p-6 max-w-xl mx-auto text-center mt-12 bg-card rounded-2xl border border-border p-8 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Stethoscope size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Dental Clinic Module Required</h2>
          <p className="text-sm text-muted-foreground">
            This module is strictly isolated to stores operating with the <strong>Dental Clinic</strong> business type.
            Your current store is in <strong>{currentStore.business_type === 'grocery_bulk' ? 'Grocery / Bulk Retail' : 'Standard Retail'}</strong> mode.
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
        title="Dental Treatment Billing & Invoices"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dental-catalog')}
              className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-3.5 py-2 rounded-md text-sm font-semibold border border-border shadow-sm transition-colors"
            >
              <Layers size={15} />
              <span>Dental Catalog</span>
            </button>
            <button
              onClick={openNewInvoiceModal}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold shadow-sm hover:opacity-90"
            >
              <Plus size={16} />
              <span>New Dental Invoice</span>
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Total Billed</span>
            <h3 className="text-2xl font-bold text-foreground mt-1">{formatCurrency(summary.totalInvoiced)}</h3>
            <span className="text-xs text-muted-foreground mt-1 block">{treatments.length} total procedures</span>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Collected Revenue</span>
            <h3 className="text-2xl font-bold text-emerald-500 mt-1">{formatCurrency(summary.totalCollected)}</h3>
            <span className="text-xs text-emerald-500/80 mt-1 block">Paid into clinic accounts</span>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Outstanding Balances</span>
            <h3 className="text-2xl font-bold text-amber-500 mt-1">{formatCurrency(summary.totalOutstanding)}</h3>
            <span className="text-xs text-amber-500/80 mt-1 block">Pending patient collection</span>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Today's Invoices</span>
            <h3 className="text-2xl font-bold text-cyan-500 mt-1">{summary.todayCount}</h3>
            <span className="text-xs text-muted-foreground mt-1 block">Invoices generated today</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice #, patient, procedure, or doctor..."
              className="w-full pl-10 pr-4 h-10 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3.5 h-10 rounded-lg bg-card border border-border text-sm font-semibold text-foreground"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid in Full</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Unpaid / Due</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Invoice #</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Patient</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Procedures & Items</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Paid / Balance</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Loading dental invoices...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      No treatment billing records found. Click "New Dental Invoice" to create one.
                    </td>
                  </tr>
                ) : (
                  filtered.map(item => {
                    const parsedLines = parseItemsDetail(item.items_detail);
                    const svcCount = parsedLines.filter(l => l.type === 'service').length;
                    const prdCount = parsedLines.filter(l => l.type === 'product').length;

                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-bold text-foreground block">
                            {item.invoice_no || '—'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {String(item.performed_at || item.created_at).split('T')[0].split(' ')[0]}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-sm text-foreground">{item.patient_name}</div>
                          {item.doctor_name && (
                            <div className="text-xs text-muted-foreground">By: {item.doctor_name}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                            <span>{item.procedure_name}</span>
                            {item.tooth_numbers && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-500 text-[10px] font-mono font-bold">
                                {item.tooth_numbers}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{item.category}</span>
                            {parsedLines.length > 0 && (
                              <div className="flex items-center gap-1">
                                {svcCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-600 text-[10px] font-medium border border-cyan-500/20">
                                    {svcCount} {svcCount === 1 ? 'Procedure' : 'Procedures'}
                                  </span>
                                )}
                                {prdCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-medium border border-emerald-500/20">
                                    {prdCount} {prdCount === 1 ? 'Item' : 'Items'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-sm font-bold text-foreground">
                          {formatCurrency(item.total_amount)}
                          {item.discount > 0 && (
                            <div className="text-[10px] text-muted-foreground font-normal line-through">
                              Gross: {formatCurrency(item.cost)}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <div className="text-emerald-500 font-bold">Paid: {formatCurrency(item.paid_amount)}</div>
                          {item.payment_account_id && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium mt-0.5">
                              <Wallet size={10} className="text-primary" />
                              <span>{paymentAccounts.find(a => a.id === item.payment_account_id)?.account_name || 'Account'}</span>
                            </div>
                          )}
                          {item.balance_amount > 0 ? (
                            <div className="text-amber-500 font-bold">Due: {formatCurrency(item.balance_amount)}</div>
                          ) : (
                            <div className="text-muted-foreground">No balance</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${paymentStatusBadge(item.payment_status)}`}>
                            {item.payment_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.balance_amount > 0 && (
                              <button
                                onClick={() => {
                                  setShowCollectModal(item);
                                  setCollectAmount(String(item.balance_amount));
                                  setCollectAccountId(paymentAccounts[0]?.id || '');
                                }}
                                className="px-2.5 py-1.5 rounded-md bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 text-xs font-bold transition-colors"
                                title="Collect Outstanding Balance"
                              >
                                Collect
                              </button>
                            )}
                            <button
                              onClick={() => setShowPrintModal(item)}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Print Dental Invoice"
                            >
                              <Printer size={15} />
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

      {/* New Dental Invoice Modal with Dual-Catalog Line Items */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-2xl border border-border max-w-4xl w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Stethoscope size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">New Dental Treatment Invoice</h2>
                  <p className="text-xs text-muted-foreground">Combine clinical services and physical dental items in an integrated billing invoice</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-5">
              {/* Patient Selection Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Select Registered Patient
                  </label>
                  <select
                    value={form.patient_id}
                    onChange={e => handlePatientSelect(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-semibold"
                  >
                    <option value="">— Or Type Patient Below —</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.phone ? `(${p.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    value={form.patient_name}
                    onChange={e => setForm({ ...form, patient_name: e.target.value })}
                    placeholder="Patient full name"
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Attending Dentist / Doctor
                  </label>
                  <input
                    type="text"
                    value={form.doctor_name}
                    onChange={e => setForm({ ...form, doctor_name: e.target.value })}
                    placeholder="Dr. Full Name"
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-medium"
                  />
                </div>
              </div>

              {/* DUAL-CATALOG LINE ITEMS SECTION */}
              <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-foreground block">
                      Treatment Line Items (Services & Supplies)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Services auto-fill predefined fees without inventory deduction. Physical items auto-fill retail prices and decrement stock.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddServiceLine()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      <Plus size={14} />
                      <Stethoscope size={13} />
                      <span>Add Service</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddProductLine()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      <Plus size={14} />
                      <Package size={13} />
                      <span>Add Dental Item</span>
                    </button>
                  </div>
                </div>

                {/* Line Items List */}
                {lineItems.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg bg-card p-4">
                    <p className="text-sm font-medium text-muted-foreground">No line items added yet.</p>
                    <div className="flex justify-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => handleAddServiceLine()}
                        className="px-3 py-1.5 rounded bg-cyan-600 text-white text-xs font-bold"
                      >
                        + Add Service
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddProductLine()}
                        className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold"
                      >
                        + Add Dental Product
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {lineItems.map((line, index) => {
                      const isService = line.type === 'service';
                      const stockWarning = !isService && line.current_stock !== undefined && line.quantity > line.current_stock;

                      return (
                        <div
                          key={line.id}
                          className={`p-3 rounded-lg border bg-card text-foreground transition-all space-y-2 ${
                            isService ? 'border-cyan-500/30' : 'border-emerald-500/30'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            {/* Line Type Badge */}
                            <div className="flex items-center gap-1.5 min-w-[90px]">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                  isService
                                    ? 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30'
                                    : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                }`}
                              >
                                {isService ? <Stethoscope size={11} /> : <Package size={11} />}
                                {isService ? 'Service' : 'Item'}
                              </span>
                            </div>

                            {/* Catalog Selection / Name Input */}
                            <div className="flex-1 min-w-[200px]">
                              {isService ? (
                                <div className="space-y-1">
                                  <select
                                    value={line.item_id || 'custom'}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val === 'custom') {
                                        handleUpdateLineItem(line.id, {
                                          item_id: undefined,
                                          name: '',
                                          category: 'Clinical Procedure',
                                          unit_price: 0,
                                        });
                                      } else {
                                        handleUpdateLineItem(line.id, { item_id: val });
                                      }
                                    }}
                                    className="w-full px-2.5 h-8 rounded-md border border-input bg-background text-xs font-semibold"
                                  >
                                    <option value="custom">— Custom Procedure —</option>
                                    {catalogServices.map(svc => (
                                      <option key={svc.id} value={svc.id}>
                                        {svc.name} — {formatCurrency(svc.sell_price || svc.retail_price || 0)}
                                      </option>
                                    ))}
                                  </select>
                                  {(!line.item_id || line.item_id === 'custom') && (
                                    <input
                                      type="text"
                                      value={line.name}
                                      onChange={e => handleUpdateLineItem(line.id, { name: e.target.value })}
                                      placeholder="Type procedure name..."
                                      className="w-full px-2.5 h-7 rounded-md border border-input bg-background text-xs"
                                      required
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <select
                                    value={line.item_id || ''}
                                    onChange={e => handleUpdateLineItem(line.id, { item_id: e.target.value })}
                                    className="w-full px-2.5 h-8 rounded-md border border-input bg-background text-xs font-semibold"
                                    required
                                  >
                                    <option value="">— Select Dental Item —</option>
                                    {catalogProducts.map(prd => (
                                      <option key={prd.id} value={prd.id}>
                                        {prd.name} — {formatCurrency(prd.sell_price || prd.retail_price || 0)} (Stock: {prd.quantity || 0})
                                      </option>
                                    ))}
                                  </select>
                                  {line.current_stock !== undefined && (
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <span className={`font-semibold ${line.current_stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        Available Stock: {line.current_stock}
                                      </span>
                                      {stockWarning && (
                                        <span className="text-rose-500 font-bold flex items-center gap-0.5">
                                          <AlertTriangle size={11} /> Exceeds current stock!
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Tooth # (for services) */}
                            {isService && (
                              <div className="w-24">
                                <input
                                  type="text"
                                  value={line.tooth_number || ''}
                                  onChange={e => handleUpdateLineItem(line.id, { tooth_number: e.target.value })}
                                  placeholder="Tooth #"
                                  className="w-full px-2 h-8 rounded-md border border-cyan-500/30 bg-background text-xs font-mono text-center"
                                />
                              </div>
                            )}

                            {/* Quantity */}
                            <div className="w-20">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={line.quantity}
                                onChange={e => handleUpdateLineItem(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-full px-2 h-8 rounded-md border border-input bg-background text-xs font-bold text-center"
                                title="Quantity"
                              />
                            </div>

                            {/* Unit Price (Editable with auto-population) */}
                            <div className="w-28">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.unit_price}
                                  onChange={e => handleUpdateLineItem(line.id, { unit_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                                  className="w-full px-2 h-8 rounded-md border border-input bg-background text-xs font-bold text-right"
                                  title="Unit Price / Fee"
                                />
                              </div>
                            </div>

                            {/* Line Total */}
                            <div className="w-24 text-right">
                              <span className="text-xs font-bold text-foreground block">
                                {formatCurrency(line.total)}
                              </span>
                            </div>

                            {/* Delete Line */}
                            <div className="w-8 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(line.id)}
                                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Remove line item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Subtotals Breakdown Pill */}
                {lineItems.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div className="bg-cyan-500/10 border border-cyan-500/20 p-2 rounded-lg flex justify-between items-center">
                      <span className="text-cyan-700 font-semibold flex items-center gap-1">
                        <Stethoscope size={13} /> Services Subtotal:
                      </span>
                      <span className="font-bold text-cyan-800">{formatCurrency(subtotalServices)}</span>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg flex justify-between items-center">
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Package size={13} /> Supplies Subtotal:
                      </span>
                      <span className="font-bold text-emerald-800">{formatCurrency(subtotalProducts)}</span>
                    </div>

                    <div className="bg-muted p-2 rounded-lg flex justify-between items-center border border-border">
                      <span className="text-muted-foreground font-semibold">Gross Subtotal:</span>
                      <span className="font-bold text-foreground text-sm">{formatCurrency(grossTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnosis and Prescription Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Clinical Diagnosis Notes
                  </label>
                  <textarea
                    rows={2}
                    value={form.diagnosis}
                    onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                    placeholder="e.g. Pulpitis on #14, Grade 2 Mobility, Subgingival Calculus..."
                    className="w-full p-2.5 rounded-lg border border-input bg-background text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Dental Prescription & Rx
                  </label>
                  <textarea
                    rows={2}
                    value={form.prescription}
                    onChange={e => setForm({ ...form, prescription: e.target.value })}
                    placeholder="e.g. Amoxicillin 500mg TDS x 5d, Ibuprofen 400mg PRN"
                    className="w-full p-2.5 rounded-lg border border-input bg-background text-xs text-foreground font-mono"
                  />
                </div>
              </div>

              {/* Pricing, Discount & Payment Settlement Section */}
              <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Invoice Settlement & Payment Collection
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Gross Subtotal</label>
                    <div className="h-10 px-3 rounded-lg bg-card border border-border flex items-center font-bold text-sm text-foreground">
                      {formatCurrency(grossTotal)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Discount Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.discount}
                      onChange={e => setForm({ ...form, discount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-bold text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-primary block mb-1">Net Payable Total</label>
                    <div className="h-10 px-3 rounded-lg bg-card border border-primary/40 flex items-center font-black text-sm text-primary">
                      {formatCurrency(netTotal)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                  <div>
                    <label className="text-xs font-semibold text-emerald-500 block mb-1">Amount Paid Now ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={netTotal}
                      value={form.paid_amount}
                      onChange={e => setForm({ ...form, paid_amount: e.target.value })}
                      className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-bold text-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Method</label>
                    <select
                      value={form.payment_method}
                      onChange={e => handlePaymentMethodChange(e.target.value)}
                      className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-semibold"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Deposit To Account (Ledger) *</label>
                    <select
                      value={form.payment_account_id}
                      onChange={e => setForm({ ...form, payment_account_id: e.target.value })}
                      className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-semibold"
                    >
                      {paymentAccounts.length === 0 ? (
                        <option value="">Default Cash Account</option>
                      ) : (
                        paymentAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.account_name} ({acc.account_type}{acc.provider_name ? ` • ${acc.provider_name}` : ''})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {balanceNum > 0 ? (
                  <div className="text-xs font-bold text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 flex justify-between">
                    <span>Remaining Patient Balance Due:</span>
                    <span>{formatCurrency(balanceNum)}</span>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-emerald-600 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Paid in Full — No Outstanding Balance</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
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
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? 'Generating Invoice...' : 'Generate Invoice & Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Balance Modal */}
      {showCollectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCollectModal(null)}>
          <div className="bg-card rounded-2xl border border-border max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-lg font-bold text-foreground">Collect Dental Balance</h2>
              <button onClick={() => setShowCollectModal(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCollectBalance} className="space-y-4">
              <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice #</span>
                  <span className="font-mono font-bold text-foreground">{showCollectModal.invoice_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient</span>
                  <span className="font-semibold text-foreground">{showCollectModal.patient_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outstanding Balance</span>
                  <span className="font-bold text-amber-500">{formatCurrency(showCollectModal.balance_amount)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Payment Amount Received *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={showCollectModal.balance_amount}
                  value={collectAmount}
                  onChange={e => setCollectAmount(e.target.value)}
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm font-bold text-foreground"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Payment Method</label>
                  <select
                    value={collectMethod}
                    onChange={e => {
                      const m = e.target.value;
                      setCollectMethod(m);
                      const matched = getMatchingAccountId(m, paymentAccounts);
                      if (matched) setCollectAccountId(matched);
                    }}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-semibold"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Deposit To Account (Ledger) *</label>
                  <select
                    value={collectAccountId}
                    onChange={e => setCollectAccountId(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-semibold"
                    required
                  >
                    {paymentAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({acc.account_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(null)}
                  className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Dental Treatment Invoice Modal with Itemized Breakdown */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrintModal(null)}>
          <div className="bg-white text-black rounded-2xl max-w-2xl w-full p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto print:p-0 print:shadow-none" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                  {currentStore?.store_name || 'Dental Clinic'}
                </h1>
                <p className="text-xs text-gray-600 mt-0.5">{currentStore?.location || 'Dental Care & Surgery Center'}</p>
                <p className="text-xs text-gray-600">Phone: {currentStore?.phone || '—'}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest block">DENTAL INVOICE</span>
                <span className="text-sm font-mono font-bold text-gray-800">{showPrintModal.invoice_no}</span>
                <span className="text-xs text-gray-500 block mt-1">
                  {String(showPrintModal.performed_at || showPrintModal.created_at).split('T')[0].split(' ')[0]}
                </span>
              </div>
            </div>

            {/* Patient & Doctor Details */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="font-bold text-gray-500 uppercase tracking-wider block">Patient Information</span>
                <span className="text-sm font-bold text-gray-900 block mt-0.5">{showPrintModal.patient_name}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-500 uppercase tracking-wider block">Attending Dentist</span>
                <span className="text-sm font-bold text-gray-900 block mt-0.5">{showPrintModal.doctor_name || 'Dr. On Duty'}</span>
              </div>
            </div>

            {/* Itemized Procedures & Supplies Table */}
            {(() => {
              const lines = parseItemsDetail(showPrintModal.items_detail);
              const hasLineItems = lines.length > 0;
              const svcSubtotal = lines.filter(l => l.type === 'service').reduce((s, l) => s + (Number(l.total) || 0), 0);
              const prdSubtotal = lines.filter(l => l.type === 'product').reduce((s, l) => s + (Number(l.total) || 0), 0);

              return (
                <div className="space-y-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-900">
                        <th className="py-2 font-bold uppercase">Description & Details</th>
                        <th className="py-2 font-bold uppercase text-center">Type</th>
                        <th className="py-2 font-bold uppercase text-center">Tooth #</th>
                        <th className="py-2 font-bold uppercase text-center">Qty</th>
                        <th className="py-2 font-bold uppercase text-right">Unit Price</th>
                        <th className="py-2 font-bold uppercase text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {hasLineItems ? (
                        lines.map((line, idx) => (
                          <tr key={line.id || idx}>
                            <td className="py-2.5 font-semibold text-gray-900">
                              <div>{line.name}</div>
                              {line.category && <div className="text-[10px] text-gray-500">{line.category}</div>}
                            </td>
                            <td className="py-2.5 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  line.type === 'service'
                                    ? 'bg-cyan-100 text-cyan-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {line.type === 'service' ? 'Procedure' : 'Item'}
                              </span>
                            </td>
                            <td className="py-2.5 text-center font-mono font-bold text-gray-700">
                              {line.tooth_number || '—'}
                            </td>
                            <td className="py-2.5 text-center font-bold text-gray-800">
                              {line.quantity}
                            </td>
                            <td className="py-2.5 text-right text-gray-700">
                              {formatCurrency(line.unit_price)}
                            </td>
                            <td className="py-2.5 text-right font-bold text-gray-900">
                              {formatCurrency(line.total)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-3 font-semibold text-gray-900" colSpan={2}>
                            <div>{showPrintModal.procedure_name}</div>
                            <div className="text-[11px] text-gray-500">{showPrintModal.category}</div>
                          </td>
                          <td className="py-3 text-center font-mono font-bold text-gray-800">
                            {showPrintModal.tooth_numbers || '—'}
                          </td>
                          <td className="py-3 text-center font-bold text-gray-800">1</td>
                          <td className="py-3 text-right text-gray-700">{formatCurrency(showPrintModal.cost)}</td>
                          <td className="py-3 text-right font-bold text-gray-900">{formatCurrency(showPrintModal.cost)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Financial Summary */}
                  <div className="flex justify-end text-xs">
                    <div className="w-64 space-y-1.5 border-t-2 border-gray-900 pt-2">
                      {hasLineItems && svcSubtotal > 0 && prdSubtotal > 0 && (
                        <>
                          <div className="flex justify-between text-gray-600">
                            <span>Services Subtotal:</span>
                            <span>{formatCurrency(svcSubtotal)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>Supplies Subtotal:</span>
                            <span>{formatCurrency(prdSubtotal)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-gray-600">
                        <span>Gross Subtotal:</span>
                        <span>{formatCurrency(showPrintModal.cost)}</span>
                      </div>
                      {showPrintModal.discount > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Discount:</span>
                          <span>-{formatCurrency(showPrintModal.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm text-gray-900 border-t pt-1">
                        <span>Grand Total:</span>
                        <span>{formatCurrency(showPrintModal.total_amount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-600">
                        <span>Paid ({showPrintModal.payment_method || 'Cash'}):</span>
                        <span>{formatCurrency(showPrintModal.paid_amount)}</span>
                      </div>
                      {showPrintModal.balance_amount > 0 && (
                        <div className="flex justify-between font-bold text-amber-600 border-t pt-1">
                          <span>Balance Due:</span>
                          <span>{formatCurrency(showPrintModal.balance_amount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Diagnosis and Prescription */}
            {(showPrintModal.diagnosis || showPrintModal.prescription) && (
              <div className="space-y-3 pt-2">
                {showPrintModal.diagnosis && (
                  <div className="border border-gray-200 p-3 rounded-xl bg-gray-50 text-xs">
                    <span className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Diagnosis & Findings</span>
                    <p className="text-gray-800 italic">{showPrintModal.diagnosis}</p>
                  </div>
                )}
                {showPrintModal.prescription && (
                  <div className="border border-gray-300 p-3.5 rounded-xl bg-gray-50 text-xs">
                    <span className="font-bold text-cyan-800 uppercase tracking-wider block mb-1 font-mono">Rx / Dental Prescription</span>
                    <p className="font-mono text-gray-800 whitespace-pre-wrap">{showPrintModal.prescription}</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer & Signature */}
            <div className="pt-6 border-t flex justify-between items-end text-xs text-gray-500">
              <div>
                <p className="font-medium italic">Thank you for visiting {currentStore?.store_name || 'our dental clinic'}!</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Wishing you a healthy, bright smile.</p>
              </div>
              <div className="text-right">
                <div className="border-b border-gray-400 w-36 mb-1"></div>
                <span className="text-[10px] uppercase font-bold text-gray-500">Authorized Signature</span>
              </div>
            </div>

            {/* Action Buttons (Hidden when printed) */}
            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintModal(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-lg bg-cyan-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-cyan-700 shadow-sm"
              >
                <Printer size={14} /> Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
