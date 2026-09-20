import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import FAB from '@/components/FAB';
import { Search, Clock, Trash2, Download, Plus, ScanBarcode, AlertTriangle, Package, Filter, Pencil, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
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
import BarcodeScanner from '@/components/BarcodeScanner';
import { toast } from 'sonner';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

function getStockStatus(item: { type: string; quantity: number; low_stock_threshold: number }) {
  if (item.type !== 'product') return 'service';
  if (item.quantity === 0) return 'out_of_stock';
  if (item.quantity <= item.low_stock_threshold) return 'low_stock';
  return 'in_stock';
}

function StockBadge({ status }: { status: string }) {
  if (status === 'out_of_stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
        Out of Stock
      </span>
    );
  }
  if (status === 'low_stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-bold uppercase tracking-wide">
        <AlertTriangle size={10} />
        Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
      In Stock
    </span>
  );
}

export default function InventoryPage() {
  const { items, categories, addItem, addItemsBulk, updateItem, deleteItem, currentStore, formatCurrency } = useApp();
  const [tab, setTab] = useState<'product' | 'service'>('product');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', barcode: '', cost_price: '', sell_price: '', quantity: '', low_stock_threshold: '5' });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const storeItems = items.filter(i => i.store_id === currentStore?.id && i.type === tab && i.is_active);
  const storeCategories = categories.filter(c => c.store_id === currentStore?.id);
  const existingItemCategories = Array.from(new Set(storeItems.map(i => i.category).filter(Boolean)));
  // Merge created categories with existing items categories just in case
  const allCategoryNames = Array.from(new Set([...storeCategories.map(c => c.name), ...existingItemCategories]));

  // Apply search and category filter
  let filtered = storeItems.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    (i.category || '').toLowerCase().includes(search.toLowerCase()) || 
    (i.barcode || '').includes(search)
  );

  if (categoryFilter !== 'all') {
    filtered = filtered.filter(i => i.category === categoryFilter);
  }

  // Apply stock filter (products only)
  if (tab === 'product' && stockFilter !== 'all') {
    filtered = filtered.filter(i => getStockStatus(i) === stockFilter);
  }

  // Stock summary counts
  const lowStockItems = storeItems.filter(i => getStockStatus(i) === 'low_stock');
  const outOfStockItems = storeItems.filter(i => getStockStatus(i) === 'out_of_stock');
  const inStockItems = storeItems.filter(i => getStockStatus(i) === 'in_stock');

  const openEdit = (item: any) => {
    setEditingItem(item.id);
    setForm({
      name: item.name,
      category: item.category || '',
      barcode: item.barcode || '',
      cost_price: String(item.cost_price),
      sell_price: String(item.sell_price),
      quantity: String(item.quantity),
      low_stock_threshold: String(item.low_stock_threshold),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateItem(editingItem, {
          name: form.name,
          category: form.category.trim(),
          barcode: form.barcode,
          cost_price: Number(form.cost_price),
          sell_price: Number(form.sell_price),
          quantity: tab === 'product' ? Number(form.quantity) : 0,
          low_stock_threshold: Number(form.low_stock_threshold),
        });
        toast.success('Item updated successfully');
        setEditingItem(null);
      } else {
        await addItem({
          store_id: currentStore?.id || '',
          item_code: `#${String(items.length + 1).padStart(3, '0')}`,
          name: form.name,
          category: form.category.trim(),
          type: tab,
          barcode: form.barcode,
          cost_price: Number(form.cost_price),
          sell_price: Number(form.sell_price),
          quantity: tab === 'product' ? Number(form.quantity) : 0,
          low_stock_threshold: Number(form.low_stock_threshold),
          is_active: true,
        });
        toast.success('Item added successfully');
      }
      setForm({ name: '', category: '', barcode: '', cost_price: '', sell_price: '', quantity: '', low_stock_threshold: '5' });
      setShowForm(false);
      setEditingItem(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save item');
    }
  };

  const handleDownloadExcel = () => {
    if (storeItems.length === 0) {
      toast.error('No items to export');
      return;
    }
    const dataToExport = storeItems.map(item => ({
      Type: item.type,
      Name: item.name,
      Category: item.category || '',
      Barcode: item.barcode || '',
      CostPrice: item.cost_price,
      SellPrice: item.sell_price,
      Quantity: item.quantity || 0,
      LowStockThreshold: item.low_stock_threshold || 5,
    }));
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory_${currentStore?.store_name || 'export'}.xlsx`);
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (!data || data.length === 0) {
          toast.error('No valid data found in file');
          return;
        }

        const newItems = data.map((row: any) => ({
          store_id: currentStore?.id || '',
          type: (row.Type || 'product').toLowerCase(),
          name: String(row.Name || ''),
          category: String(row.Category || '').trim(),
          barcode: String(row.Barcode || ''),
          cost_price: Number(row.CostPrice) || 0,
          sell_price: Number(row.SellPrice) || 0,
          quantity: Number(row.Quantity) || 0,
          low_stock_threshold: Number(row.LowStockThreshold) || 5,
          is_active: true
        })).filter((item: any) => item.name); // only include rows with a name
        
        if (newItems.length === 0) {
          toast.error('No valid items found to import (Name is required)');
          return;
        }
        
        await addItemsBulk(newItems);
        toast.success(`Successfully imported ${newItems.length} items`);
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to import file: ' + err.message);
      }
      e.target.value = ''; // reset file input
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <PageHeader title="Inventory Page" rightAction={<Download size={22} className="text-foreground" />} />
      <div className="px-4 lg:px-8 py-4 lg:py-6 space-y-4 max-w-7xl mx-auto w-full">

        {/* Stock Summary Cards (products only) */}
        {tab === 'product' && (
          <div className="grid grid-cols-3 gap-3 animate-fade-in">
            <button
              onClick={() => setStockFilter(stockFilter === 'in_stock' ? 'all' : 'in_stock')}
              className={`rounded-xl p-3 text-center transition-all border ${
                stockFilter === 'in_stock' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border bg-card'
              }`}
            >
              <p className="text-lg lg:text-2xl font-extrabold text-primary">{inStockItems.length}</p>
              <p className="text-[10px] lg:text-xs font-semibold text-muted-foreground">In Stock</p>
            </button>
            <button
              onClick={() => setStockFilter(stockFilter === 'low_stock' ? 'all' : 'low_stock')}
              className={`rounded-xl p-3 text-center transition-all border ${
                stockFilter === 'low_stock' ? 'border-warning bg-warning/10 ring-2 ring-warning/20' : 'border-border bg-card'
              }`}
            >
              <p className="text-lg lg:text-2xl font-extrabold text-warning">{lowStockItems.length}</p>
              <p className="text-[10px] lg:text-xs font-semibold text-muted-foreground">Low Stock</p>
            </button>
            <button
              onClick={() => setStockFilter(stockFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
              className={`rounded-xl p-3 text-center transition-all border ${
                stockFilter === 'out_of_stock' ? 'border-destructive bg-destructive/10 ring-2 ring-destructive/20' : 'border-border bg-card'
              }`}
            >
              <p className="text-lg lg:text-2xl font-extrabold text-destructive">{outOfStockItems.length}</p>
              <p className="text-[10px] lg:text-xs font-semibold text-muted-foreground">Out of Stock</p>
            </button>
          </div>
        )}

        {/* Low stock notification banner */}
        {tab === 'product' && (lowStockItems.length > 0 || outOfStockItems.length > 0) && stockFilter === 'all' && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in">
            <AlertTriangle size={18} className="text-destructive shrink-0" />
            <p className="text-sm font-semibold text-destructive flex-1">
              {outOfStockItems.length > 0 && `${outOfStockItems.length} out of stock`}
              {outOfStockItems.length > 0 && lowStockItems.length > 0 && ' · '}
              {lowStockItems.length > 0 && `${lowStockItems.length} running low`}
            </p>
            <button
              onClick={() => setStockFilter('low_stock')}
              className="text-xs font-bold text-destructive hover:underline shrink-0"
            >
              View
            </button>
          </div>
        )}

        {/* Search + Add */}
        <div className="relative flex gap-2">
          <div className="relative flex-1 lg:max-w-md">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inventory"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground" />
          </div>
          <select 
            value={categoryFilter} 
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-4 py-3 rounded-xl border border-input bg-card text-foreground hidden md:block"
          >
            <option value="all">All Categories</option>
            {allCategoryNames.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(stockFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              onClick={() => { setStockFilter('all'); setCategoryFilter('all'); }}
              className="px-3 py-2 rounded-xl border border-input bg-accent text-foreground text-sm font-medium flex items-center gap-1"
            >
              <Filter size={14} /> Clear
            </button>
          )}
          <button onClick={handleDownloadExcel} className="hidden lg:flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-foreground font-medium border border-border">
            <Download size={18} /> Export
          </button>
          <label className="hidden lg:flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-foreground font-medium border border-border cursor-pointer">
            <Upload size={18} /> Import
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadExcel} />
          </label>
          <button onClick={() => setShowForm(true)} className="w-12 h-12 rounded-full bg-primary flex items-center justify-center lg:hidden">
            <Plus size={22} className="text-primary-foreground" />
          </button>
          <button onClick={() => setShowForm(true)} className="hidden lg:flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium">
            <Plus size={18} /> Add Item
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-card rounded-xl overflow-hidden lg:max-w-xs">
          <button onClick={() => { setTab('product'); setStockFilter('all'); }}
            className={`flex-1 py-3 font-medium ${tab === 'product' ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
            Products
          </button>
          <button onClick={() => { setTab('service'); setStockFilter('all'); }}
            className={`flex-1 py-3 font-medium ${tab === 'service' ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
            Services
          </button>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center">
            <Package size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium">
              {stockFilter !== 'all' ? `No ${stockFilter.replace('_', ' ')} items found.` : `No ${tab}s found.`}
            </p>
            {stockFilter !== 'all' && (
              <button onClick={() => setStockFilter('all')} className="mt-2 text-sm text-primary font-semibold">
                Show all items
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: Table layout */}
            <div className="hidden lg:block bg-card rounded-2xl ring-1 ring-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Code</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Product Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Barcode</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Cost Price</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Sell Price</th>
                    {tab === 'product' && (
                      <>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Remaining</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Low Stock Level</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                      </>
                    )}
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const status = getStockStatus(item);
                    const isAlert = status === 'low_stock' || status === 'out_of_stock';
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-border last:border-0 transition-colors ${
                          isAlert
                            ? 'bg-destructive/5 hover:bg-destructive/10'
                            : 'hover:bg-accent/20'
                        }`}
                      >
                        <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{item.item_code}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${isAlert ? 'text-destructive' : 'text-foreground'}`}>
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.category || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.barcode || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground text-right">{formatCurrency(item.cost_price)}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-primary text-right">{formatCurrency(item.sell_price)}</td>
                        {tab === 'product' && (
                          <>
                            <td className={`px-5 py-3.5 text-sm font-bold text-right ${
                              status === 'out_of_stock' ? 'text-destructive' :
                              status === 'low_stock' ? 'text-destructive' :
                              'text-primary'
                            }`}>
                              {item.quantity}
                            </td>
                            <td className="px-5 py-3.5 text-sm text-muted-foreground text-right">
                              {item.low_stock_threshold}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <StockBadge status={status} />
                            </td>
                          </>
                        )}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"><Pencil size={16} className="text-primary" /></button>
                            <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"><Trash2 size={16} className="text-destructive" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: Card layout */}
            <div className="lg:hidden space-y-3">
              {filtered.map(item => {
                const status = getStockStatus(item);
                const isAlert = status === 'low_stock' || status === 'out_of_stock';
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-4 border transition-all ${
                      isAlert
                        ? 'bg-destructive/8 border-destructive/25 ring-1 ring-destructive/10'
                        : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="bg-card px-2 py-1 rounded text-xs font-medium text-muted-foreground border border-border">{item.item_code}</span>
                        <h4 className={`font-bold truncate ${isAlert ? 'text-destructive' : 'text-foreground'}`}>{item.name}</h4>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-2">
                        <button onClick={() => openEdit(item)}>
                          <Pencil size={18} className="text-primary" />
                        </button>
                        <button onClick={() => setDeleteTarget(item)}>
                          <Trash2 size={18} className="text-destructive" />
                        </button>
                      </div>
                    </div>

                    {tab === 'product' && (
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            status === 'out_of_stock' || status === 'low_stock' ? 'text-destructive' : 'text-primary'
                          }`}>
                            Remaining: {item.quantity}
                          </span>
                          <StockBadge status={status} />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between mt-1">
                      <p className="text-sm text-muted-foreground">Cost: {formatCurrency(item.cost_price)}</p>
                      <p className="text-sm font-medium text-primary">Sell: {formatCurrency(item.sell_price)}</p>
                    </div>

                    {tab === 'product' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Low stock level: {item.low_stock_threshold}
                      </p>
                    )}

                    {item.barcode && <p className="text-xs text-muted-foreground mt-1">⊞ {item.barcode}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end lg:items-center lg:justify-center">
           <div className="w-full lg:w-[480px] bg-card rounded-t-2xl lg:rounded-2xl p-6 max-h-[80vh] overflow-y-auto">
             <h3 className="text-lg font-bold text-foreground mb-4">{editingItem ? 'Edit' : 'Add'} {tab === 'product' ? 'Product' : 'Service'}</h3>
             <form onSubmit={handleSubmit} className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Item name"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" required />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground appearance-none">
                <option value="">Select Category (Optional)</option>
                {allCategoryNames.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="relative flex gap-2">
                <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="Barcode (optional)"
                  className="flex-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
                <button type="button" onClick={() => setShowScanner(true)}
                  className="w-12 h-12 rounded-lg border border-input bg-accent/30 flex items-center justify-center text-primary active:scale-95 transition-transform">
                  <ScanBarcode size={22} />
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <input type="number" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="Cost price"
                  className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" required />
                <input type="number" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} placeholder="Sell price (optional)"
                  className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              </div>
              {tab === 'product' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Quantity"
                    className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" required />
                  <input type="number" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} placeholder="Low stock threshold"
                    className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); setForm({ name: '', barcode: '', cost_price: '', sell_price: '', quantity: '', low_stock_threshold: '5' }); }} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">{editingItem ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setForm(f => ({ ...f, barcode: code }));
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteItem(deleteTarget?.id); setDeleteTarget(null); }} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
