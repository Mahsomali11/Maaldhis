import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { api as apiClient } from '@/api';
import PageHeader from '@/components/PageHeader';
import { Plus, X, Package, Search, PlusCircle, Trash2, CheckCircle2, Clock, FileText, ScanBarcode, RotateCcw, AlertTriangle } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';

const BarcodeScanner = lazy(() => import('@/components/BarcodeScanner'));
export default function PurchasesPage() {
  const { purchases, purchaseItems: globalPurchaseItems, suppliers, items, categories, currentStore, formatCurrency, recordPurchase, refreshData, userRole } = useApp();
  const isGroceryMode = currentStore?.business_type === 'grocery_bulk';
  const canManagePurchases = !userRole || userRole === 'owner' || userRole === 'admin' || userRole === 'clinic_admin';
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeletingPurchase, setIsDeletingPurchase] = useState(false);
  const [returnTarget, setReturnTarget] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnLines, setReturnLines] = useState<{
    purchase_item_id: string;
    item_id: string;
    return_quantity: string;
    return_unit_type: 'base' | 'wholesale';
  }[]>([]);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'pending' | 'completed'>('completed');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<{
    item_id: string;
    quantity: number;
    cost_price: number;
    sell_price: number;
    unit_type?: 'base' | 'wholesale';
    conversion_factor?: number;
  }[]>([]);
  const [updateCostPrice, setUpdateCostPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Add Product State
  const [showQuickAddProduct, setShowQuickAddProduct] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [quickAddSubCategory, setQuickAddSubCategory] = useState('');
  const [quickAddBarcode, setQuickAddBarcode] = useState('');
  const [quickAddCostPrice, setQuickAddCostPrice] = useState('');
  const [quickAddSellingPrice, setQuickAddSellingPrice] = useState('');
  const [quickAddWholesalePrice, setQuickAddWholesalePrice] = useState('');
  const [quickAddAllowDecimalQty, setQuickAddAllowDecimalQty] = useState(false);
  const [quickAddBaseUnit, setQuickAddBaseUnit] = useState('KG');
  const [quickAddWholesaleUnit, setQuickAddWholesaleUnit] = useState('');
  const [quickAddConversionFactor, setQuickAddConversionFactor] = useState('1');
  const [quickAddInitialQuantity, setQuickAddInitialQuantity] = useState('');
  const [quickAddLowStock, setQuickAddLowStock] = useState('5');
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Category computation
  const storeItems = useMemo(() => items.filter(i => i.store_id === currentStore?.id && i.type === 'product' && i.is_active), [items, currentStore]);
  const storeCategories = useMemo(() => categories.filter(c => c.store_id === currentStore?.id), [categories, currentStore]);
  const allCategoryNames = useMemo(() => {
    const existingItemCategories = Array.from(new Set(storeItems.map(i => i.category).filter(Boolean)));
    return Array.from(new Set([...storeCategories.filter(c => !c.parent_id).map(c => c.name), ...existingItemCategories]));
  }, [storeCategories, storeItems]);

  useEffect(() => {
    if (!currentStore) return;
    apiClient
      .from('payment_accounts')
      .select('id, account_name, account_type, is_active')
      .eq('store_id', currentStore.id)
      .eq('is_active', true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPaymentAccounts(data);
          setPaymentAccountId(data[0].id);
        }
      });
  }, [currentStore?.id]);

  // Derived Values
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const sup = suppliers.find(s => s.id === p.supplier_id);
      const matchesSearch = p.reference_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sup && sup.name.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [purchases, searchTerm, suppliers]);

  const totalPurchaseAmount = useMemo(() => {
    return purchaseItems.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);
  }, [purchaseItems]);

  const handleAddItem = () => {
    setPurchaseItems([...purchaseItems, { item_id: '', quantity: 1, cost_price: 0, sell_price: 0, unit_type: 'base', conversion_factor: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...purchaseItems];
    if (field === 'item_id') {
      const selectedItem = items.find(i => i.id === value);
      newItems[index] = {
        ...newItems[index],
        item_id: value,
        unit_type: 'base',
        conversion_factor: 1,
        cost_price: selectedItem ? Number(selectedItem.cost_price) : 0,
        sell_price: selectedItem ? Number(selectedItem.retail_price ?? selectedItem.sell_price) : 0
      };
    } else if (field === 'unit_type') {
      const currentRow = newItems[index];
      const selectedItem = items.find(i => i.id === currentRow.item_id);
      const factor = Math.max(0.001, Number(selectedItem?.conversion_factor) || 1);
      const prevUnit = currentRow.unit_type || 'base';

      if (value === 'wholesale' && prevUnit !== 'wholesale') {
        const baseCost = currentRow.cost_price > 0 ? Number(currentRow.cost_price) : Number(selectedItem?.cost_price || 0);
        const newCost = Number((baseCost * factor).toFixed(2));
        const newSell = selectedItem?.wholesale_price && Number(selectedItem.wholesale_price) > 0
          ? Number(selectedItem.wholesale_price)
          : Number(((Number(selectedItem?.retail_price ?? selectedItem?.sell_price) || 0) * factor).toFixed(2));
        newItems[index] = {
          ...currentRow,
          unit_type: 'wholesale',
          conversion_factor: factor,
          cost_price: newCost,
          sell_price: newSell,
        };
      } else if (value === 'base' && prevUnit === 'wholesale') {
        const wholesaleCost = currentRow.cost_price > 0 ? Number(currentRow.cost_price) : (Number(selectedItem?.cost_price || 0) * factor);
        const newCost = Number((wholesaleCost / factor).toFixed(2));
        const newSell = Number(selectedItem?.retail_price ?? selectedItem?.sell_price ?? 0);
        newItems[index] = {
          ...currentRow,
          unit_type: 'base',
          conversion_factor: 1,
          cost_price: newCost,
          sell_price: newSell,
        };
      } else {
        newItems[index] = { ...currentRow, unit_type: value };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setPurchaseItems(newItems);
  };

  const handleQuickAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore || isSubmittingProduct) return;
    setIsSubmittingProduct(true);

    try {
      const parsedRetailPrice = Number(quickAddSellingPrice) || 0;
      const parsedWholesalePrice = isGroceryMode && quickAddWholesaleUnit.trim() && quickAddWholesalePrice !== ''
        ? Number(quickAddWholesalePrice)
        : null;
      const parsedConversionFactor = isGroceryMode && quickAddWholesaleUnit.trim() && Number(quickAddConversionFactor) > 0
        ? Number(quickAddConversionFactor)
        : 1;

      const { data, error } = await apiClient.from('items').insert({
        store_id: currentStore.id,
        name: quickAddName,
        type: 'product',
        category: quickAddCategory || 'General',
        sub_category_id: quickAddSubCategory || null,
        barcode: quickAddBarcode,
        low_stock_threshold: Number(quickAddLowStock) || 5,
        cost_price: Number(quickAddCostPrice) || 0,
        sell_price: parsedRetailPrice,
        retail_price: parsedRetailPrice,
        allow_decimal_qty: isGroceryMode ? Boolean(quickAddAllowDecimalQty) : false,
        base_unit: isGroceryMode ? (quickAddBaseUnit.trim() || 'KG') : 'Piece',
        wholesale_unit: isGroceryMode && quickAddWholesaleUnit.trim() ? quickAddWholesaleUnit.trim() : null,
        conversion_factor: isGroceryMode ? parsedConversionFactor : 1,
        wholesale_price: isGroceryMode ? parsedWholesalePrice : null,
        quantity: 0,
        is_active: true
      });

      if (error) throw new Error(error.message || 'Failed to add product');

      // Ensure data exists
      const newItem = Array.isArray(data) ? data[0] : data;

      // Add to global items temporarily so dropdown finds it immediately
      if (newItem) {
        items.push(newItem);

        // Add to purchase line items
        const newItems = [...purchaseItems];
        newItems.push({
          item_id: newItem.id,
          quantity: Number(quickAddInitialQuantity) || 1,
          cost_price: Number(quickAddCostPrice) || 0,
          sell_price: parsedRetailPrice,
          unit_type: 'base',
          conversion_factor: 1,
        });
        setPurchaseItems(newItems);
      }

      // trigger global data refresh in background
      if (refreshData) refreshData();

      setShowQuickAddProduct(false);
      setQuickAddName('');
      setQuickAddCategory('');
      setQuickAddSubCategory('');
      setQuickAddBarcode('');
      setQuickAddCostPrice('');
      setQuickAddSellingPrice('');
      setQuickAddWholesalePrice('');
      setQuickAddAllowDecimalQty(false);
      setQuickAddBaseUnit(isGroceryMode ? 'KG' : 'Piece');
      setQuickAddWholesaleUnit('');
      setQuickAddConversionFactor('1');
      setQuickAddInitialQuantity('');
      setQuickAddLowStock('5');
    } catch (err: any) {
      alert(err.message || 'Error saving product');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!currentStore) return;
    if (purchaseItems.length === 0) {
      alert("Please add at least one item to the purchase.");
      return;
    }

    const hasInvalidItems = purchaseItems.some(i => !i.item_id || i.quantity <= 0 || i.cost_price < 0);
    if (hasInvalidItems) {
      alert("Please ensure all selected items have a valid quantity and cost price.");
      return;
    }

    setIsSubmitting(true);
    try {
      await recordPurchase({
        store_id: currentStore.id,
        supplier_id: supplierId,
        payment_account_id: paymentAccountId || null,
        date,
        paid_amount: Number(paidAmount) || 0,
        status,
        items: purchaseItems,
        update_cost_price: updateCostPrice,
        notes
      });
      setShowForm(false);

      // Reset form
      setSupplierId('');
      setDate(new Date().toISOString().split('T')[0]);
      setStatus('completed');
      setPaymentAccountId('');
      setPaidAmount('');
      setNotes('');
      setPurchaseItems([]);
      setUpdateCostPrice(false);

    } catch (err: any) {
      alert(err.message || "Failed to record purchase.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveLineMeta = (pi: any) => {
    const product = items.find(i => i.id === pi.item_id);
    if (!isGroceryMode) {
      return {
        product,
        unitType: 'base' as const,
        unitName: 'Piece',
        factor: 1,
        baseQty: Math.round(Number(pi.quantity || 0)),
        baseUnitLabel: 'Piece',
        wholesaleUnitLabel: '',
        itemFactor: 1,
      };
    }

    const baseUnitLabel = product?.base_unit || 'KG';
    const wholesaleUnitLabel = product?.wholesale_unit?.trim() || '';
    const itemFactor = Math.max(0.001, Number(product?.conversion_factor) || 1);

    if (pi.base_quantity !== undefined && pi.base_quantity !== null && pi.unit_type) {
      const factor = Math.max(0.001, Number(pi.conversion_factor || (pi.unit_type === 'wholesale' ? itemFactor : 1)));
      return {
        product,
        unitType: (pi.unit_type === 'wholesale' ? 'wholesale' : 'base') as 'base' | 'wholesale',
        unitName: pi.unit_name || (pi.unit_type === 'wholesale' && wholesaleUnitLabel ? wholesaleUnitLabel : baseUnitLabel),
        factor,
        baseQty: Number(Number(pi.base_quantity).toFixed(3)),
        baseUnitLabel,
        wholesaleUnitLabel,
        itemFactor,
      };
    }

    // Legacy heuristic for purchase lines recorded prior to base_quantity column
    let isLegacyWholesale = false;
    if (wholesaleUnitLabel && itemFactor > 1 && product && Number(product.cost_price) > 0) {
      const expectedWholesaleCost = Number(product.cost_price) * itemFactor;
      if (Number(pi.cost_price) >= expectedWholesaleCost * 0.5) {
        isLegacyWholesale = true;
      }
    }

    const factor = isLegacyWholesale ? itemFactor : 1;
    return {
      product,
      unitType: (isLegacyWholesale ? 'wholesale' : 'base') as 'base' | 'wholesale',
      unitName: isLegacyWholesale ? wholesaleUnitLabel : baseUnitLabel,
      factor,
      baseQty: Number((Number(pi.quantity || 0) * factor).toFixed(3)),
      baseUnitLabel,
      wholesaleUnitLabel,
      itemFactor,
    };
  };

  const openReturnModal = (purchase: any) => {
    const pItems = globalPurchaseItems.filter((pi: any) => pi.purchase_id === purchase.id && Number(pi.quantity) > 0);
    setReturnTarget(purchase);
    setReturnReason('');
    setReturnLines(
      pItems.map((pi: any) => {
        const meta = resolveLineMeta(pi);
        return {
          purchase_item_id: pi.id,
          item_id: pi.item_id,
          return_quantity: '',
          return_unit_type: meta.unitType,
        };
      })
    );
  };

  const handleDeletePurchase = async () => {
    if (!deleteTarget || isDeletingPurchase) return;
    setIsDeletingPurchase(true);
    try {
      const res = await apiClient.post('/rest/v1/delete-purchase', {
        purchase_id: deleteTarget.id,
      });
      if (res.data?.error) {
        throw new Error(res.data.error);
      }
      toast.success(res.data?.message || `Purchase ${deleteTarget.reference_no} deleted and reversed.`);
      if (selectedPurchase?.id === deleteTarget.id) {
        setSelectedPurchase(null);
      }
      setDeleteTarget(null);
      if (refreshData) await refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to delete purchase');
    } finally {
      setIsDeletingPurchase(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget || isSubmittingReturn) return;

    const validItems = returnLines
      .map(line => ({
        purchase_item_id: line.purchase_item_id,
        return_quantity: Number(line.return_quantity || 0),
        return_unit_type: isGroceryMode ? line.return_unit_type : 'base',
      }))
      .filter(line => line.return_quantity > 0);

    if (validItems.length === 0) {
      toast.error('Please enter a return quantity greater than 0 for at least one item.');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res = await apiClient.post('/rest/v1/return-purchase', {
        purchase_id: returnTarget.id,
        items: validItems,
        reason: returnReason.trim() || undefined,
      });
      if (res.data?.error) {
        throw new Error(res.data.error);
      }
      toast.success(res.data?.message || 'Purchase return processed successfully.');
      if (selectedPurchase?.id === returnTarget.id && res.data?.purchase) {
        setSelectedPurchase(res.data.purchase);
      }
      setReturnTarget(null);
      setReturnLines([]);
      setReturnReason('');
      if (refreshData) await refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to process purchase return');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-background pb-12">
      <PageHeader
        title="Purchases"
        rightAction={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Purchase</span>
          </button>
        }
      />

      <div className="p-4 sm:p-6 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Search Bar */}
        <div className="flex items-center bg-card rounded-2xl border border-border px-4 py-2 shadow-sm max-w-md">
          <Search size={18} className="text-muted-foreground mr-3" />
          <input
            type="text"
            placeholder="Search by reference or supplier..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full h-10 text-foreground"
          />
        </div>

        {/* Purchases Table */}
        {filteredPurchases.length === 0 ? (
          <div className="bg-card rounded-3xl border border-border p-16 text-center shadow-sm flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Package size={32} className="text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No purchases found</h3>
            <p className="text-muted-foreground text-sm max-w-sm">Record new incoming stock from your suppliers.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-sm"
            >
              Add Purchase
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-border/50 bg-muted/10">
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Reference</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Supplier</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Total</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Paid</th>
                  {canManagePurchases && (
                    <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredPurchases.map(purchase => {
                  const sup = suppliers.find(s => s.id === purchase.supplier_id);
                  const isReturned = purchase.status === 'Returned' || purchase.status === 'returned';
                  return (
                    <tr
                      key={purchase.id}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedPurchase(purchase)}
                    >
                      <td className="px-6 py-4">
                        <span className="font-bold text-foreground text-sm">{purchase.reference_no}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-muted-foreground">
                        {new Date(purchase.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {sup?.name || 'Unknown Supplier'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold">
                            <RotateCcw size={12} />
                            Returned
                          </span>
                        ) : (purchase.status === 'completed' || purchase.status === 'Completed') ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                            <CheckCircle2 size={12} />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold">
                            <Clock size={12} />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-foreground text-right">
                        {formatCurrency(purchase.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-muted-foreground text-right">
                        {formatCurrency(purchase.paid_amount)}
                      </td>
                      {canManagePurchases && (
                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {!isReturned && Number(purchase.total_amount) > 0 && (
                              <button
                                type="button"
                                onClick={() => openReturnModal(purchase)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors"
                                title="Return items to supplier"
                              >
                                <RotateCcw size={13} />
                                <span className="hidden md:inline">Return</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(purchase)}
                              className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                              title="Delete purchase and reverse stock"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Purchase Details Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border bg-muted/10 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <FileText size={20} className="text-primary" />
                  Purchase Details
                </h3>
                <p className="text-sm font-mono text-muted-foreground mt-1">Ref: {selectedPurchase.reference_no}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManagePurchases && selectedPurchase.status !== 'Returned' && Number(selectedPurchase.total_amount) > 0 && (
                  <button
                    type="button"
                    onClick={() => openReturnModal(selectedPurchase)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors"
                  >
                    <RotateCcw size={14} />
                    Return Purchase
                  </button>
                )}
                {canManagePurchases && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selectedPurchase)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
                >
                  Print
                </button>
                <button
                  onClick={() => setSelectedPurchase(null)}
                  className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Summary Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-muted/30 border border-border">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Supplier</p>
                  <p className="font-medium text-sm text-foreground">
                    {suppliers.find(s => s.id === selectedPurchase.supplier_id)?.name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Date</p>
                  <p className="font-medium text-sm text-foreground">
                    {new Date(selectedPurchase.date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                  <div className="font-medium text-sm text-foreground">
                    {(selectedPurchase.status === 'Returned' || selectedPurchase.status === 'returned') ? (
                      <span className="inline-flex items-center gap-1.5 text-rose-500 font-bold">
                        <RotateCcw size={12} /> Returned
                      </span>
                    ) : (selectedPurchase.status === 'completed' || selectedPurchase.status === 'Completed') ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-500 font-bold">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-500 font-bold">
                        <Clock size={12} /> Pending
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Account</p>
                  <p className="font-medium text-sm text-foreground">
                    {paymentAccounts.find(a => a.id === selectedPurchase.payment_account_id)?.account_name || 'None'}
                  </p>
                </div>
              </div>

              {selectedPurchase.notes && (
                <div className="px-4 py-3 rounded-xl bg-muted/20 border border-border text-xs text-muted-foreground">
                  <strong className="text-foreground">Notes:</strong> {selectedPurchase.notes}
                </div>
              )}

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-foreground mb-3 text-sm">Line Items</h4>
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/10">
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item Name</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Qty</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Cost</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {globalPurchaseItems.filter((pi: any) => pi.purchase_id === selectedPurchase.id).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No items found for this purchase.</td>
                        </tr>
                      ) : (
                        globalPurchaseItems.filter((pi: any) => pi.purchase_id === selectedPurchase.id).map((item: any) => {
                          const meta = resolveLineMeta(item);
                          return (
                            <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-sm font-bold text-foreground">
                                {meta.product?.name || 'Unknown Item'}
                                {Number(item.returned_quantity || 0) > 0 && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold">
                                    Returned: {Number(item.returned_quantity)} {isGroceryMode ? meta.unitName : ''}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                {item.quantity} {isGroceryMode ? meta.unitName : ''}
                                {isGroceryMode && meta.unitType === 'wholesale' && meta.factor > 1 && (
                                  <span className="block text-[10px] text-muted-foreground">
                                    ({meta.baseQty} {meta.baseUnitLabel})
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                                {formatCurrency(item.cost_price)}
                                {isGroceryMode && <span className="text-[10px] ml-0.5">/{meta.unitName}</span>}
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-foreground text-right">{formatCurrency(item.subtotal)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3 max-w-sm ml-auto">
                <div className="flex justify-between items-center text-sm text-muted-foreground font-medium">
                  <span>Total Amount</span>
                  <span>{formatCurrency(selectedPurchase.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-muted-foreground font-medium">
                  <span>Paid Amount</span>
                  <span>{formatCurrency(selectedPurchase.paid_amount)}</span>
                </div>
                <div className="h-px bg-border w-full"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground uppercase tracking-widest">Balance Due</span>
                  <span className="text-lg font-black text-destructive">
                    {formatCurrency(Math.max(0, Number(selectedPurchase.total_amount) - Number(selectedPurchase.paid_amount)))}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Return Purchase Modal */}
      {returnTarget && (
        <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl max-h-[90vh] bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border bg-muted/10 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <RotateCcw size={20} className="text-amber-500" />
                  Return Purchase to Supplier
                </h3>
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  Ref: {returnTarget.reference_no} • Supplier: {suppliers.find(s => s.id === returnTarget.supplier_id)?.name || 'Unknown'}
                </p>
              </div>
              <button
                onClick={() => setReturnTarget(null)}
                className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5">
              <div className="space-y-3">
                {returnLines.map((rLine, idx) => {
                  const pi = globalPurchaseItems.find((p: any) => p.id === rLine.purchase_item_id);
                  if (!pi) return null;
                  const meta = resolveLineMeta(pi);
                  const product = meta.product;
                  const hasWholesaleOption = isGroceryMode && Boolean(meta.wholesaleUnitLabel) && meta.itemFactor > 1;
                  const selectedReturnFactor = isGroceryMode && rLine.return_unit_type === 'wholesale' && hasWholesaleOption
                    ? meta.itemFactor
                    : 1;
                  const selectedReturnUnitName = isGroceryMode
                    ? (rLine.return_unit_type === 'wholesale' && hasWholesaleOption ? meta.wholesaleUnitLabel : meta.baseUnitLabel)
                    : 'Piece';
                  const parsedReturnQty = Math.max(0, Number(rLine.return_quantity || 0));
                  const returnBaseQty = Number((parsedReturnQty * selectedReturnFactor).toFixed(isGroceryMode ? 3 : 0));
                  const baseUnitCost = meta.factor > 0 ? Number(pi.cost_price) / meta.factor : Number(pi.cost_price);
                  const lineReturnValue = Number((returnBaseQty * baseUnitCost).toFixed(2));
                  const maxReturnInSelectedUnit = selectedReturnFactor > 0
                    ? Number((meta.baseQty / selectedReturnFactor).toFixed(isGroceryMode ? 3 : 0))
                    : meta.baseQty;

                  return (
                    <div key={rLine.purchase_item_id} className="p-4 rounded-2xl bg-background border border-border shadow-sm space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{product?.name || 'Unknown Product'}</h4>
                          <p className="text-xs text-muted-foreground">
                            Purchased Remaining: <strong className="text-foreground">{pi.quantity} {isGroceryMode ? meta.unitName : ''}</strong>
                            {isGroceryMode && meta.unitType === 'wholesale' && meta.factor > 1 && (
                              <span> ({meta.baseQty} {meta.baseUnitLabel})</span>
                            )}
                            {' • '}Current Stock: <strong className="text-foreground">{product?.quantity ?? 0} {isGroceryMode ? meta.baseUnitLabel : ''}</strong>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground block">Return Credit</span>
                          <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                            {formatCurrency(lineReturnValue)}
                          </span>
                        </div>
                      </div>

                      <div className={isGroceryMode ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
                        {isGroceryMode && (
                          <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              Return Unit
                            </label>
                            <select
                              value={rLine.return_unit_type}
                              onChange={e => {
                                const next = [...returnLines];
                                next[idx] = { ...next[idx], return_unit_type: e.target.value as 'base' | 'wholesale' };
                                setReturnLines(next);
                              }}
                              className="w-full px-3 h-10 rounded-xl border border-input bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="base">{meta.baseUnitLabel} (Base Unit)</option>
                              {hasWholesaleOption && (
                                <option value="wholesale">
                                  {meta.wholesaleUnitLabel} ({meta.itemFactor} {meta.baseUnitLabel})
                                </option>
                              )}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            Return Quantity {isGroceryMode ? `(${selectedReturnUnitName})` : ''} — Max: {maxReturnInSelectedUnit}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={maxReturnInSelectedUnit}
                            step={isGroceryMode ? '0.001' : '1'}
                            placeholder="0"
                            value={rLine.return_quantity}
                            onChange={e => {
                              const next = [...returnLines];
                              next[idx] = { ...next[idx], return_quantity: e.target.value };
                              setReturnLines(next);
                            }}
                            className="w-full px-3 h-10 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>

                      {parsedReturnQty > 0 && (
                        <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            Inventory Reduction: <strong className="text-amber-600 dark:text-amber-400">-{returnBaseQty} {isGroceryMode ? meta.baseUnitLabel : 'Units'}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Credit Adjustment: <strong className="text-foreground">{formatCurrency(lineReturnValue)}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Return Reason / Notes
                </label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="e.g. Damaged packaging, expired items, supplier credit note..."
                  className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="flex-1 py-3 rounded-xl bg-background border border-border text-foreground text-sm font-bold hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmittingReturn ? 'Processing Return...' : 'Confirm Purchase Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Purchase Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete & Reverse Purchase?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Deleting <strong className="text-foreground">{deleteTarget.reference_no}</strong> ({formatCurrency(deleteTarget.total_amount)}) will automatically subtract its added stock from inventory and reverse its financial/supplier credit records.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1.5 max-h-44 overflow-y-auto">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Inventory Stock to Reverse</p>
              {globalPurchaseItems
                .filter((pi: any) => pi.purchase_id === deleteTarget.id && Number(pi.quantity) > 0)
                .map((pi: any) => {
                  const meta = resolveLineMeta(pi);
                  return (
                    <div key={pi.id} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground truncate pr-2">{meta.product?.name || 'Item'}</span>
                      <span className="font-bold text-destructive shrink-0">
                        -{meta.baseQty} {isGroceryMode ? meta.baseUnitLabel : 'Units'}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeletingPurchase}
                className="flex-1 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-bold hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePurchase}
                disabled={isDeletingPurchase}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isDeletingPurchase ? 'Reversing...' : 'Yes, Delete & Reverse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Purchase Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border bg-muted/10 shrink-0">
              <h3 className="text-xl font-bold text-foreground">Record Purchase</h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-8 space-y-6">

              {/* Header Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Supplier <span className="text-destructive">*</span></label>
                  <SearchableSelect
                    value={supplierId}
                    onChange={setSupplierId}
                    options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                    placeholder="Select Supplier"
                    searchPlaceholder="Search supplier name..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Date <span className="text-destructive">*</span></label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Status <span className="text-destructive">*</span></label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm appearance-none"
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed (Updates Stock)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-muted/30 rounded-2xl p-4 border border-border">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-foreground">Purchase Items <span className="text-destructive">*</span></h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddName('');
                        setQuickAddCategory('');
                        setQuickAddSubCategory('');
                        setQuickAddBarcode('');
                        setQuickAddCostPrice('');
                        setQuickAddSellingPrice('');
                        setQuickAddWholesalePrice('');
                        setQuickAddAllowDecimalQty(false);
                        setQuickAddBaseUnit(isGroceryMode ? 'KG' : 'Piece');
                        setQuickAddWholesaleUnit('');
                        setQuickAddConversionFactor('1');
                        setQuickAddInitialQuantity('');
                        setShowQuickAddProduct(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                    >
                      <Plus size={14} /> Quick Add Product
                    </button>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                    >
                      <PlusCircle size={14} /> Add Item Row
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {purchaseItems.map((item, index) => {
                    const selectedItem = items.find(i => i.id === item.item_id);
                    const baseUnitLabel = selectedItem?.base_unit || (isGroceryMode ? 'KG' : 'Piece');
                    const wholesaleUnitLabel = selectedItem?.wholesale_unit?.trim() || '';
                    const hasWholesaleUnit = isGroceryMode && Boolean(wholesaleUnitLabel);
                    const factor = Math.max(0.001, Number(selectedItem?.conversion_factor) || 1);
                    const activeUnitLabel = isGroceryMode
                      ? (item.unit_type === 'wholesale' && hasWholesaleUnit ? wholesaleUnitLabel : baseUnitLabel)
                      : '';
                    const addedBaseQty = item.unit_type === 'wholesale' && hasWholesaleUnit
                      ? Number(((Number(item.quantity) || 0) * factor).toFixed(3))
                      : Number((Number(item.quantity) || 0).toFixed(3));

                    return (
                      <div key={index} className="bg-background p-3.5 rounded-xl border border-border shadow-sm space-y-2.5 overflow-hidden">
                        <div
                          className={
                            isGroceryMode
                              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] gap-2.5 items-end'
                              : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[minmax(0,2.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] gap-2.5 items-end'
                          }
                        >
                          <div className="min-w-0 sm:col-span-2 md:col-span-1">
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 truncate">
                              Product
                            </label>
                            <SearchableSelect
                              value={item.item_id}
                              onChange={val => handleItemChange(index, 'item_id', val)}
                              options={items.filter(i => i.type === 'product').map(i => {
                                const bUnit = i.base_unit || (isGroceryMode ? 'KG' : 'Piece');
                                const wUnit = i.wholesale_unit?.trim();
                                const cFactor = Number(i.conversion_factor || 1);
                                return {
                                  value: i.id,
                                  label: i.name,
                                  subLabel: isGroceryMode
                                    ? `Stock: ${i.quantity} ${bUnit}${wUnit && cFactor > 1 ? ` • 1 ${wUnit} = ${cFactor} ${bUnit}` : ''}`
                                    : `Stock: ${i.quantity}`,
                                  badge: i.barcode ? `Barcode: ${i.barcode}` : undefined
                                };
                              })}
                              placeholder="Select Inventory Item"
                              searchPlaceholder="Search item name or barcode..."
                              triggerClassName="h-10 text-xs sm:text-sm rounded-lg px-2.5"
                              required
                            />
                          </div>

                          {isGroceryMode && (
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 truncate">
                                Unit
                              </label>
                              <select
                                value={item.unit_type || 'base'}
                                onChange={e => handleItemChange(index, 'unit_type', e.target.value)}
                                disabled={!selectedItem}
                                title="Purchase Unit"
                                className="w-full min-w-0 px-2.5 py-2 h-10 rounded-lg border border-input bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 truncate"
                              >
                                <option value="base">{baseUnitLabel} (Base)</option>
                                {hasWholesaleUnit && (
                                  <option value="wholesale">
                                    {wholesaleUnitLabel} ({factor} {baseUnitLabel})
                                  </option>
                                )}
                              </select>
                            </div>
                          )}

                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 truncate">
                              {isGroceryMode && activeUnitLabel ? `Qty (${activeUnitLabel})` : 'Qty'}
                            </label>
                            <input
                              type="number"
                              placeholder="Qty"
                              min={isGroceryMode ? '0.001' : '0.01'}
                              step={isGroceryMode ? '0.001' : '0.01'}
                              value={item.quantity || ''}
                              onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))}
                              className="w-full min-w-0 px-2.5 py-2 h-10 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                              required
                            />
                          </div>

                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 truncate">
                              {isGroceryMode && activeUnitLabel ? `Cost / ${activeUnitLabel}` : 'Cost Price'}
                            </label>
                            <input
                              type="number"
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              value={item.cost_price === 0 ? '' : item.cost_price}
                              onChange={e => handleItemChange(index, 'cost_price', Number(e.target.value))}
                              className="w-full min-w-0 px-2.5 py-2 h-10 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                              required
                            />
                          </div>

                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 truncate">
                              {isGroceryMode && activeUnitLabel ? `Sell / ${activeUnitLabel}` : 'Sell Price'}
                            </label>
                            <input
                              type="number"
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              value={item.sell_price === 0 ? '' : item.sell_price}
                              onChange={e => handleItemChange(index, 'sell_price', Number(e.target.value))}
                              className="w-full min-w-0 px-2.5 py-2 h-10 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 h-10 shrink-0 pl-1">
                            <span className="font-bold text-sm text-foreground whitespace-nowrap">
                              {formatCurrency(item.quantity * item.cost_price)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
                              title="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {isGroceryMode && selectedItem && (
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/15 text-xs">
                            <span className="font-semibold text-foreground">
                              Stock Added: <strong className="text-primary">+{addedBaseQty} {baseUnitLabel}</strong>
                              {item.unit_type === 'wholesale' && hasWholesaleUnit && (
                                <span className="text-muted-foreground ml-1.5">
                                  ({item.quantity || 0} {wholesaleUnitLabel} × {factor} {baseUnitLabel})
                                </span>
                              )}
                            </span>
                            {item.unit_type === 'wholesale' && hasWholesaleUnit && factor > 0 && (
                              <span className="text-muted-foreground font-medium">
                                Base Cost: <strong className="text-foreground">{formatCurrency((Number(item.cost_price) || 0) / factor)}</strong> / {baseUnitLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {purchaseItems.length === 0 && (
                    <div className="text-center py-6 text-sm font-medium text-muted-foreground border-2 border-dashed border-border rounded-xl">
                      No items added yet. Click "Add Item" to begin.
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end text-lg font-black text-foreground pt-4 border-t border-border">
                  Total: {formatCurrency(totalPurchaseAmount)}
                </div>
              </div>

              {/* Financial Tracking */}
              <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10">
                <h4 className="font-bold text-primary mb-4 flex items-center gap-2">
                  <FileText size={16} /> Financial Recording
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="paid"
                        checked={paidAmount !== '0' && paidAmount !== ''}
                        onChange={() => setPaidAmount(String(totalPurchaseAmount))}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-bold text-foreground">Paid (Now)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="credit"
                        checked={paidAmount === '0' || paidAmount === ''}
                        onChange={() => {
                          setPaidAmount('0');
                          setPaymentAccountId('');
                        }}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-bold text-foreground">Credit / Pay Later</span>
                    </label>
                  </div>

                  {(paidAmount !== '0' && paidAmount !== '') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Amount Paid Now</label>
                        <input
                          type="number"
                          value={paidAmount}
                          onChange={e => setPaidAmount(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          max={totalPurchaseAmount}
                          className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
                        />
                      </div>
                      {Number(paidAmount) > 0 && paymentAccounts.length > 0 && (
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Payment Account</label>
                          <SearchableSelect
                            value={paymentAccountId}
                            onChange={setPaymentAccountId}
                            options={paymentAccounts.map(pa => ({
                              value: pa.id,
                              label: `${pa.account_name} (${pa.account_type})`
                            }))}
                            placeholder="Select Account"
                            searchPlaceholder="Search payment account..."
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </form>

            <div className="flex gap-3 px-6 py-5 border-t border-border bg-muted/10 shrink-0">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl bg-background border border-border text-foreground text-sm font-bold hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                data-submit-guard="true"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  'Process Purchase'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {showQuickAddProduct && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[90vh] bg-card rounded-2xl sm:rounded-3xl border border-border shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-5 border-b border-border bg-muted/10 shrink-0">
              <h3 className="text-xl font-bold text-foreground">Quick Add Product</h3>
              <button
                onClick={() => setShowQuickAddProduct(false)}
                className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleQuickAddProduct} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-muted-foreground capitalize tracking-wider mb-2">Item Name <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={quickAddName}
                  onChange={e => setQuickAddName(e.target.value)}
                  placeholder="Enter item name"
                  className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground capitalize tracking-wider mb-2">Category</label>
                <SearchableSelect
                  value={quickAddCategory}
                  onChange={val => { setQuickAddCategory(val); setQuickAddSubCategory(''); }}
                  options={allCategoryNames}
                  placeholder="Select Category (Optional)"
                  searchPlaceholder="Search category..."
                  clearLabel="No Category"
                  allowClear
                />
              </div>

              {/* Sub-Category dynamic rendering */}
              {(() => {
                const selectedCatObj = storeCategories.find(c => c.name === quickAddCategory && !c.parent_id);
                if (!selectedCatObj) return null;
                const availableSubcategories = storeCategories.filter(c => c.parent_id === selectedCatObj.id);
                if (availableSubcategories.length === 0) return null;

                return (
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground capitalize tracking-wider mb-2">Sub-Category</label>
                    <SearchableSelect
                      value={quickAddSubCategory}
                      onChange={setQuickAddSubCategory}
                      options={availableSubcategories.map(sub => ({ value: sub.id, label: sub.name }))}
                      placeholder="Select Sub-Category (Optional)"
                      searchPlaceholder="Search sub-category..."
                      clearLabel="No Sub-Category"
                      allowClear
                    />
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-muted-foreground capitalize tracking-wider mb-2">Barcode</label>
                <div className="relative flex gap-2">
                  <input
                    value={quickAddBarcode}
                    onChange={e => setQuickAddBarcode(e.target.value)}
                    placeholder="Optional barcode"
                    className="flex-1 px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-11 h-11 rounded-xl border border-border bg-background shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <ScanBarcode size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground capitalize tracking-wider mb-2">
                    Cost Price {isGroceryMode && quickAddBaseUnit ? `(per ${quickAddBaseUnit})` : ''} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={quickAddCostPrice}
                    onChange={e => setQuickAddCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground capitalize tracking-wider mb-2">
                    {isGroceryMode ? `Retail Price (per ${quickAddBaseUnit || 'Base Unit'})` : 'Sell Price'} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={quickAddSellingPrice}
                    onChange={e => setQuickAddSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                    required
                  />
                </div>
              </div>

              {isGroceryMode && (
                <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground block">Grocery / Bulk Unit Configuration</span>
                      <span className="text-[11px] text-muted-foreground">Track stock in Base Units and optionally buy/sell in Wholesale Units</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quickAddAllowDecimalQty}
                        onChange={e => setQuickAddAllowDecimalQty(e.target.checked)}
                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-bold text-foreground">Allow Decimal Qty (0.2, 0.5)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground capitalize tracking-wider mb-1">Base Unit (Stock Unit) *</label>
                      <select
                        value={quickAddBaseUnit}
                        onChange={e => setQuickAddBaseUnit(e.target.value)}
                        className="w-full px-3 h-10 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="KG">KG (Kilogram)</option>
                        <option value="Liter">Liter (L)</option>
                        <option value="Piece">Piece (Pcs)</option>
                        <option value="Gram">Gram (g)</option>
                        <option value="ML">Milliliter (mL)</option>
                        <option value="Packet">Packet</option>
                        <option value="Meter">Meter (m)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground capitalize tracking-wider mb-1">Wholesale Unit (Optional)</label>
                      <input
                        value={quickAddWholesaleUnit}
                        onChange={e => setQuickAddWholesaleUnit(e.target.value)}
                        placeholder="e.g. Jawaan, Can, Bag, Carton"
                        className="w-full px-3 h-10 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {quickAddWholesaleUnit.trim() !== '' && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground capitalize tracking-wider mb-1">
                          Conversion Factor ({quickAddBaseUnit}s per {quickAddWholesaleUnit})
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={quickAddConversionFactor}
                          onChange={e => setQuickAddConversionFactor(e.target.value)}
                          placeholder="e.g. 20"
                          className="w-full px-3 h-10 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-[10px] text-primary font-semibold mt-1 block">
                          1 {quickAddWholesaleUnit} = {quickAddConversionFactor || 1} {quickAddBaseUnit}
                        </span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground capitalize tracking-wider mb-1">
                          Wholesale Price (per {quickAddWholesaleUnit})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quickAddWholesalePrice}
                          onChange={e => setQuickAddWholesalePrice(e.target.value)}
                          placeholder={quickAddSellingPrice && quickAddConversionFactor ? String((Number(quickAddSellingPrice) * Number(quickAddConversionFactor)).toFixed(2)) : '0.00'}
                          className="w-full px-3 h-10 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground capitalize tracking-wider mb-2">
                    {isGroceryMode ? `Purchase Qty (in ${quickAddBaseUnit || 'Base Unit'})` : 'Initial Quantity'} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    step={isGroceryMode && quickAddAllowDecimalQty ? '0.001' : '1'}
                    value={quickAddInitialQuantity}
                    onChange={e => setQuickAddInitialQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground capitalize tracking-wider mb-2">
                    Low Stock Alert {isGroceryMode && quickAddBaseUnit ? `(${quickAddBaseUnit})` : ''}
                  </label>
                  <input
                    type="number"
                    step={isGroceryMode && quickAddAllowDecimalQty ? '0.001' : '1'}
                    value={quickAddLowStock}
                    onChange={e => setQuickAddLowStock(e.target.value)}
                    placeholder="5"
                    className="w-full px-4 py-2 h-11 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuickAddProduct(false)}
                  className="flex-1 py-3 rounded-xl bg-background border border-border text-foreground text-sm font-bold hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmittingProduct ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScanner && (
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading scanner...</div>}>
          <BarcodeScanner
            onScan={(code) => {
              setQuickAddBarcode(code);
              setShowScanner(false);
            }}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
