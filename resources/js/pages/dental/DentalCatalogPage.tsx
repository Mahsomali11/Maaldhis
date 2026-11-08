import { useState, useEffect, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import { cacheRecords } from '@/lib/offline/indexedDb';
import { toast } from 'sonner';
import {
  Layers, Stethoscope, Package, Plus, Search, Edit2, Trash2,
  AlertTriangle, CheckCircle2, ShoppingBag, DollarSign, Tag,
  ArrowRight, ShieldCheck, X, AlertCircle
} from 'lucide-react';

export interface DentalService {
  id: string;
  store_id: string;
  name: string;
  code?: string;
  item_code?: string;
  price: number;
  sell_price?: number;
  retail_price?: number;
  category?: string;
  description?: string;
  is_active: boolean;
  type?: 'service';
  created_at?: string;
  updated_at?: string;
}

export interface DentalItem {
  id: string;
  store_id: string;
  name: string;
  code?: string;
  item_code?: string;
  cost_price: number;
  retail_price: number;
  sell_price?: number;
  stock_quantity: number;
  quantity?: number;
  reorder_level: number;
  low_stock_threshold?: number;
  category?: string;
  description?: string;
  is_active: boolean;
  type?: 'product';
  created_at?: string;
  updated_at?: string;
}

const SERVICE_CATEGORIES = [
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

const ITEM_CATEGORIES = [
  'Oral Care Products (Retail)',
  'Dental Consumables & Materials',
  'Surgical & Extraction Supplies',
  'Endodontic Materials',
  'Post-Op & Care Packages',
  'Infection Control & PPE',
  'Other Dental Supplies',
];

export default function DentalCatalogPage() {
  const { currentStore, formatCurrency, user } = useApp();
  const navigate = (url: string) => router.visit(url);

  const isDentalClinic = currentStore?.business_type === 'dental_clinic';

  const [activeTab, setActiveTab] = useState<'services' | 'items'>('services');
  const [servicesList, setServicesList] = useState<DentalService[]>([]);
  const [physicalItemsList, setPhysicalItemsList] = useState<DentalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal states
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<DentalService | null>(null);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DentalItem | null>(null);

  const [saving, setSaving] = useState(false);

  // Form states
  const [serviceForm, setServiceForm] = useState({
    name: '',
    item_code: '',
    category: SERVICE_CATEGORIES[0],
    sell_price: '',
    description: '',
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    item_code: '',
    category: ITEM_CATEGORIES[0],
    cost_price: '',
    sell_price: '',
    quantity: '0',
    low_stock_threshold: '5',
    description: '',
  });

  const loadCatalog = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);

    try {
      // 1. Fetch clinical services from dedicated backend endpoint or fallback
      const [srvFetchRes, itmFetchRes] = await Promise.all([
        fetch(`/api/dental/services?store_id=${currentStore.id}`, {
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin',
        }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/dental/items?store_id=${currentStore.id}`, {
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin',
        }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      let services: DentalService[] = [];
      if (Array.isArray(srvFetchRes)) {
        cacheRecords('dental_services', srvFetchRes).catch(() => {});
        services = srvFetchRes.map(s => ({
          ...s,
          item_code: s.code || '',
          sell_price: Number(s.price || 0),
          retail_price: Number(s.price || 0),
          type: 'service' as const,
        }));
      } else {
        const { data: srvData } = await apiClient
          .from('dental_services')
          .select('*')
          .eq('store_id', currentStore.id)
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (srvData) {
          services = (srvData as any[]).map(s => ({
            ...s,
            item_code: s.code || '',
            sell_price: Number(s.price || 0),
            retail_price: Number(s.price || 0),
            type: 'service' as const,
          }));
        }
      }

      let items: DentalItem[] = [];
      if (Array.isArray(itmFetchRes)) {
        cacheRecords('dental_items', itmFetchRes).catch(() => {});
        items = itmFetchRes.map(i => ({
          ...i,
          item_code: i.code || '',
          sell_price: Number(i.retail_price || 0),
          quantity: Number(i.stock_quantity || 0),
          low_stock_threshold: Number(i.reorder_level || 5),
          type: 'product' as const,
        }));
      } else {
        const { data: itmData } = await apiClient
          .from('dental_items')
          .select('*')
          .eq('store_id', currentStore.id)
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (itmData) {
          items = (itmData as any[]).map(i => ({
            ...i,
            item_code: i.code || '',
            sell_price: Number(i.retail_price || 0),
            quantity: Number(i.stock_quantity || 0),
            low_stock_threshold: Number(i.reorder_level || 5),
            type: 'product' as const,
          }));
        }
      }

      setServicesList(services);
      setPhysicalItemsList(items);
    } catch (err) {
      console.error('Failed to load dental catalog:', err);
    } finally {
      setLoading(false);
    }
  }, [currentStore?.id]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Statistics
  const stats = useMemo(() => {
    let lowStockCount = 0;
    let inventoryValuation = 0;

    physicalItemsList.forEach(item => {
      const qty = item.quantity ?? item.stock_quantity ?? 0;
      const threshold = item.low_stock_threshold ?? item.reorder_level ?? 5;
      if (qty <= threshold) {
        lowStockCount++;
      }
      inventoryValuation += Number(qty || 0) * Number(item.cost_price || 0);
    });

    return {
      totalServices: servicesList.length,
      totalItems: physicalItemsList.length,
      lowStockCount,
      inventoryValuation,
    };
  }, [servicesList, physicalItemsList]);

  // Filtered lists based on search & category
  const filteredServices = useMemo(() => {
    const q = search.toLowerCase().trim();
    return servicesList.filter(s => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.item_code?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'all' || s.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [servicesList, search, categoryFilter]);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return physicalItemsList.filter(i => {
      const matchesSearch = !q || i.name.toLowerCase().includes(q) || i.item_code?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'all' || i.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [physicalItemsList, search, categoryFilter]);

  // --- SERVICE MODAL HANDLERS ---
  const openAddServiceModal = () => {
    setEditingService(null);
    setServiceForm({
      name: '',
      item_code: `SRV-${String(servicesList.length + 1).padStart(3, '0')}`,
      category: SERVICE_CATEGORIES[0],
      sell_price: '',
      description: '',
    });
    setShowServiceModal(true);
  };

  const openEditServiceModal = (service: DentalService) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      item_code: service.code || service.item_code || '',
      category: service.category || SERVICE_CATEGORIES[0],
      sell_price: String(service.price ?? service.sell_price ?? service.retail_price ?? 0),
      description: service.description || '',
    });
    setShowServiceModal(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id) return;
    if (!serviceForm.name.trim()) {
      toast.error('Service procedure name is required');
      return;
    }
    const feeNum = parseFloat(serviceForm.sell_price) || 0;

    setSaving(true);
    const payload = {
      store_id: currentStore.id,
      name: serviceForm.name.trim(),
      code: serviceForm.item_code.trim() || `SRV-${Date.now().toString().slice(-4)}`,
      category: serviceForm.category,
      price: feeNum,
      description: serviceForm.description || '',
      is_active: true,
    };

    try {
      if (editingService) {
        let updatedViaApi = false;
        try {
          const res = await fetch(`/api/dental/services/${editingService.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          });
          if (res.ok) updatedViaApi = true;
        } catch (_) {}

        if (!updatedViaApi) {
          // Fallback to apiClient (handles offline IndexedDB & sync queue)
          const { error: apiErr } = await apiClient
            .from('dental_services')
            .update({
              name: payload.name,
              code: payload.code,
              price: payload.price,
              category: payload.category,
              description: payload.description,
            } as any)
            .eq('id', editingService.id);

          if (apiErr) {
            throw new Error(apiErr.message || 'Failed to update service');
          }
        }

        toast.success(`Service "${serviceForm.name}" updated successfully`);
      } else {
        let createdViaApi = false;
        try {
          const res = await fetch('/api/dental/services', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          });
          if (res.ok) createdViaApi = true;
        } catch (_) {}

        if (!createdViaApi) {
          // Fallback to apiClient (handles offline IndexedDB & sync queue)
          const { error: apiErr } = await apiClient.from('dental_services').insert(payload as any);
          if (apiErr) {
            throw new Error(apiErr.message || 'Failed to add service');
          }
        }

        toast.success(`Service "${serviceForm.name}" added to catalog`);
      }

      setShowServiceModal(false);
      loadCatalog();
    } catch (err: any) {
      console.error('Error saving dental service:', err);
      toast.error(err.message || 'Failed to save clinical service');
    } finally {
      setSaving(false);
    }
  };

  // --- ITEM MODAL HANDLERS ---
  const openAddItemModal = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      item_code: `DEN-${String(physicalItemsList.length + 1).padStart(3, '0')}`,
      category: ITEM_CATEGORIES[0],
      cost_price: '',
      sell_price: '',
      quantity: '0',
      low_stock_threshold: '5',
      description: '',
    });
    setShowItemModal(true);
  };

  const openEditItemModal = (item: DentalItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      item_code: item.code || item.item_code || '',
      category: item.category || ITEM_CATEGORIES[0],
      cost_price: String(item.cost_price || 0),
      sell_price: String(item.retail_price ?? item.sell_price ?? 0),
      quantity: String(item.stock_quantity ?? item.quantity ?? 0),
      low_stock_threshold: String(item.reorder_level ?? item.low_stock_threshold ?? 5),
      description: item.description || '',
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore?.id) return;
    if (!itemForm.name.trim()) {
      toast.error('Item name is required');
      return;
    }
    const costNum = parseFloat(itemForm.cost_price) || 0;
    const sellNum = parseFloat(itemForm.sell_price) || 0;
    const qtyNum = parseFloat(itemForm.quantity) || 0;
    const thresholdNum = parseFloat(itemForm.low_stock_threshold) || 5;

    setSaving(true);
    const payload = {
      store_id: currentStore.id,
      name: itemForm.name.trim(),
      code: itemForm.item_code.trim() || `DEN-${Date.now().toString().slice(-4)}`,
      cost_price: costNum,
      retail_price: sellNum,
      stock_quantity: qtyNum,
      reorder_level: thresholdNum,
      category: itemForm.category,
      description: itemForm.description || '',
      is_active: true,
    };

    try {
      if (editingItem) {
        let updatedViaApi = false;
        try {
          const res = await fetch(`/api/dental/items/${editingItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          });
          if (res.ok) updatedViaApi = true;
        } catch (_) {}

        if (!updatedViaApi) {
          // Fallback to apiClient (handles offline IndexedDB & sync queue)
          const { error: apiErr } = await apiClient
            .from('dental_items')
            .update({
              name: payload.name,
              code: payload.code,
              cost_price: payload.cost_price,
              retail_price: payload.retail_price,
              stock_quantity: payload.stock_quantity,
              reorder_level: payload.reorder_level,
              category: payload.category,
              description: payload.description,
            } as any)
            .eq('id', editingItem.id);

          if (apiErr) {
            throw new Error(apiErr.message || 'Failed to update dental item');
          }
        }

        toast.success(`Dental item "${itemForm.name}" updated successfully`);
      } else {
        let createdViaApi = false;
        try {
          const res = await fetch('/api/dental/items', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          });
          if (res.ok) createdViaApi = true;
        } catch (_) {}

        if (!createdViaApi) {
          // Fallback to apiClient (handles offline IndexedDB & sync queue)
          const { error: apiErr } = await apiClient.from('dental_items').insert(payload as any);
          if (apiErr) {
            throw new Error(apiErr.message || 'Failed to add dental item');
          }
        }

        toast.success(`Dental item "${itemForm.name}" added to inventory`);
      }

      setShowItemModal(false);
      loadCatalog();
    } catch (err: any) {
      console.error('Error saving dental item:', err);
      toast.error(err.message || 'Failed to save dental item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (service: DentalService) => {
    if (!confirm(`Are you sure you want to remove "${service.name}" from the catalog?`)) return;
    try {
      let deletedViaApi = false;
      try {
        const res = await fetch(`/api/dental/services/${service.id}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'same-origin',
        });
        if (res.ok) deletedViaApi = true;
      } catch (_) {}

      if (!deletedViaApi) {
        await apiClient
          .from('dental_services')
          .update({ is_active: false } as any)
          .eq('id', service.id);
      }

      toast.success(`"${service.name}" removed from catalog`);
      loadCatalog();
    } catch (err) {
      toast.error('Failed to delete service');
    }
  };

  const handleDeleteItem = async (item: DentalItem) => {
    if (!confirm(`Are you sure you want to remove "${item.name}" from inventory?`)) return;
    try {
      let deletedViaApi = false;
      try {
        const res = await fetch(`/api/dental/items/${item.id}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'same-origin',
        });
        if (res.ok) deletedViaApi = true;
      } catch (_) {}

      if (!deletedViaApi) {
        await apiClient
          .from('dental_items')
          .update({ is_active: false } as any)
          .eq('id', item.id);
      }

      toast.success(`"${item.name}" removed from catalog`);
      loadCatalog();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  if (currentStore && !isDentalClinic) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeader title="Dental Catalog & Stock Management" />
        <div className="p-6 max-w-xl mx-auto mt-12 bg-card border border-border rounded-2xl shadow-sm text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
            <Stethoscope size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Dental Clinic Module Required</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The Dental Catalog & Stock Management module is only active for stores configured with the{' '}
            <strong>Dental Clinic</strong> business type. Your current store is in{' '}
            <strong className="capitalize">{currentStore.business_type?.replace('_', ' ') || 'standard retail'}</strong> mode.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Dental Catalog & Stock Management"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/purchases')}
              className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3.5 py-2 rounded-md text-sm font-bold border border-border shadow-sm hover:bg-secondary/80 transition-colors"
            >
              <ShoppingBag size={15} />
              <span>Record Purchase</span>
            </button>
            <button
              onClick={activeTab === 'services' ? openAddServiceModal : openAddItemModal}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              <span>{activeTab === 'services' ? 'Add Clinical Service' : 'Add Dental Item'}</span>
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clinical Services</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{stats.totalServices}</h3>
              <span className="text-[11px] text-muted-foreground">Procedures catalog</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Stethoscope size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Physical Items</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{stats.totalItems}</h3>
              <span className="text-[11px] text-muted-foreground">Inventory SKUs</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Package size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Low Stock Alerts</p>
              <h3 className="text-2xl font-bold text-amber-500 mt-1">{stats.lowStockCount}</h3>
              <span className="text-[11px] text-amber-500/80">Need replenishment</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Stock Valuation</p>
              <h3 className="text-2xl font-bold text-emerald-500 mt-1">{formatCurrency(stats.inventoryValuation)}</h3>
              <span className="text-[11px] text-emerald-500/80">At cost value</span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign size={22} />
            </div>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border w-fit">
            <button
              onClick={() => { setActiveTab('services'); setCategoryFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'services'
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Stethoscope size={15} />
              <span>Clinical Services ({servicesList.length})</span>
            </button>
            <button
              onClick={() => { setActiveTab('items'); setCategoryFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'items'
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package size={15} />
              <span>Dental Items & Consumables ({physicalItemsList.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={activeTab === 'services' ? 'Search procedures...' : 'Search items or code...'}
                className="w-full pl-9 pr-3 h-9 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-card border border-border text-xs font-medium text-foreground"
            >
              <option value="all">All Categories</option>
              {(activeTab === 'services' ? SERVICE_CATEGORIES : ITEM_CATEGORIES).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab 1: Clinical Services Table */}
        {activeTab === 'services' && (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Service Code</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Procedure Name</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Predefined Fee</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">Loading services catalog...</td>
                    </tr>
                  ) : filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        No clinical services found. Click "Add Clinical Service" to add procedures like Consultation, Scaling, Fillings, or Root Canals.
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map(service => (
                      <tr key={service.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-muted-foreground">
                          {service.code || service.item_code || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-sm text-foreground">
                          {service.name}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 rounded bg-muted border border-border">
                            {service.category || 'General Procedure'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-sm font-bold text-primary">
                          {formatCurrency(service.price ?? service.sell_price ?? service.retail_price ?? 0)}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 uppercase">
                            Non-Inventory Service
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/dental-billing?procedure=${encodeURIComponent(service.name)}`)}
                              className="px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold"
                              title="Bill this service"
                            >
                              Bill
                            </button>
                            <button
                              onClick={() => openEditServiceModal(service)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit Service"
                            >
                              <Edit2 size={14} />
                            </button>
                            {(user?.role === 'owner' || user?.role === 'admin' || user?.role === 'clinic_admin') && (
                              <button
                                onClick={() => handleDeleteService(service)}
                                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                title="Delete Service"
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
        )}

        {/* Tab 2: Dental Items Table (Physical Inventory) */}
        {activeTab === 'items' && (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Item Code</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Dental Item Name</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Cost Price</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Retail Price</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Stock</th>
                    <th className="py-3.5 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Loading dental inventory...</td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                        No physical dental items found. Click "Add Dental Item" to record products like Mouthwash, Toothbrushes, or Dental Kits.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => {
                      const qty = item.quantity ?? item.stock_quantity ?? 0;
                      const threshold = item.low_stock_threshold ?? item.reorder_level ?? 5;
                      const isLow = qty > 0 && qty <= threshold;
                      const isOut = qty <= 0;
                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs font-bold text-muted-foreground">
                            {item.code || item.item_code || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-sm text-foreground block">{item.name}</span>
                            <span className="text-[11px] text-muted-foreground">Min stock: {threshold}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-muted-foreground">
                            <span className="px-2 py-0.5 rounded bg-muted border border-border">
                              {item.category || 'Dental Consumables'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-sm text-muted-foreground">
                            {formatCurrency(item.cost_price || 0)}
                          </td>
                          <td className="py-3.5 px-4 text-sm font-bold text-foreground">
                            {formatCurrency(item.retail_price ?? item.sell_price ?? 0)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {qty}
                              </span>
                              {isOut ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                  In Stock
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => navigate('/purchases')}
                                className="px-2.5 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-bold border border-border/60 flex items-center gap-1"
                                title="Purchase more stock from supplier"
                              >
                                <ShoppingBag size={12} /> Stock
                              </button>
                              <button
                                onClick={() => openEditItemModal(item)}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Edit Dental Item"
                              >
                                <Edit2 size={14} />
                              </button>
                              {(user?.role === 'owner' || user?.role === 'admin' || user?.role === 'clinic_admin') && (
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Delete Item"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
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
        )}
      </div>

      {/* Service Modal (Add / Edit) */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowServiceModal(false)}>
          <div className="bg-card rounded-2xl border border-border max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Stethoscope size={20} className="text-cyan-500" />
                <h2 className="text-lg font-bold text-foreground">
                  {editingService ? 'Edit Clinical Service' : 'Add Clinical Service / Procedure'}
                </h2>
              </div>
              <button onClick={() => setShowServiceModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Service / Procedure Name *
                </label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="e.g. Scaling & Polishing, Root Canal Therapy"
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Service Code
                  </label>
                  <input
                    type="text"
                    value={serviceForm.item_code}
                    onChange={e => setServiceForm({ ...serviceForm, item_code: e.target.value })}
                    placeholder="e.g. SRV-001"
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-primary uppercase tracking-wider block mb-1">
                    Predefined Fee *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={serviceForm.sell_price}
                    onChange={e => setServiceForm({ ...serviceForm, sell_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-bold text-foreground"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Category
                </label>
                <select
                  value={serviceForm.category}
                  onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })}
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                >
                  {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20 text-xs text-muted-foreground">
                <span className="font-bold text-cyan-500 block mb-0.5">Non-Inventory Service:</span>
                Clinical procedures do not track inventory stock. When added to a treatment invoice, this fee will automatically populate.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingService ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dental Item Modal (Add / Edit Physical Product) */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowItemModal(false)}>
          <div className="bg-card rounded-2xl border border-border max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  {editingItem ? 'Edit Dental Item' : 'Add Dental Item / Consumable'}
                </h2>
              </div>
              <button onClick={() => setShowItemModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g. Chlorhexidine Mouthwash, Orthodontic Wax"
                  className="w-full px-3.5 h-10 rounded-lg border border-input bg-background text-sm text-foreground font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Item Code / SKU
                  </label>
                  <input
                    type="text"
                    value={itemForm.item_code}
                    onChange={e => setItemForm({ ...itemForm, item_code: e.target.value })}
                    placeholder="e.g. DEN-001"
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={itemForm.category}
                    onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm text-foreground"
                  >
                    {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Cost Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemForm.cost_price}
                    onChange={e => setItemForm({ ...itemForm, cost_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-bold text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-primary uppercase tracking-wider block mb-1">
                    Retail Selling Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemForm.sell_price}
                    onChange={e => setItemForm({ ...itemForm, sell_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-bold text-foreground"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Current Stock Quantity
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={itemForm.quantity}
                    onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-bold text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-amber-500 uppercase tracking-wider block mb-1">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={itemForm.low_stock_threshold}
                    onChange={e => setItemForm({ ...itemForm, low_stock_threshold: e.target.value })}
                    className="w-full px-3 h-10 rounded-lg border border-input bg-background text-sm font-bold text-foreground"
                  />
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-xl border border-border text-xs text-muted-foreground">
                <span className="font-bold text-foreground block mb-0.5">Physical Inventory Item:</span>
                Stock level is automatically decremented when added to a Treatment Invoice, and increased when recorded through the Purchases module.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
