import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { Search, QrCode, Check } from 'lucide-react';
import { toast } from 'sonner';
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

export default function ReturnsPage() {
  const { sales, saleItems, recordReturn, currentStore, formatCurrency } = useApp();
  const [receiptSearch, setReceiptSearch] = useState('');
  const [foundSale, setFoundSale] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [confirmReturn, setConfirmReturn] = useState(false);

  const sale = foundSale ? sales.find(s => s.id === foundSale) : null;
  const sItems = sale ? saleItems.filter(si => si.sale_id === sale.id) : [];

  const handleSearch = () => {
    const found = sales.find(s => s.receipt_no.toLowerCase().includes(receiptSearch.toLowerCase()) && s.store_id === currentStore?.id);
    setFoundSale(found?.id || null);
    setSelectedItems({});
    if (!found) toast.error('No receipt found');
  };

  const toggleItem = (saleItemId: string, maxQty: number) => {
    setSelectedItems(prev => {
      if (prev[saleItemId]) {
        const { [saleItemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [saleItemId]: maxQty };
    });
  };

  const updateQty = (saleItemId: string, qty: number, maxQty: number) => {
    if (qty <= 0 || qty > maxQty) return;
    setSelectedItems(prev => ({ ...prev, [saleItemId]: qty }));
  };

  const isFullReturn = Object.keys(selectedItems).length === sItems.length &&
    sItems.every(si => selectedItems[si.id] === si.quantity);

  const totalRefund = sItems
    .filter(si => selectedItems[si.id])
    .reduce((sum, si) => sum + (si.sell_price * (selectedItems[si.id] || 0)), 0);

  const handleReturn = () => {
    if (!sale || Object.keys(selectedItems).length === 0) return;
    const returnItems = sItems
      .filter(si => selectedItems[si.id])
      .map(si => ({
        item_id: si.item_id,
        sale_item_id: si.id,
        quantity: selectedItems[si.id],
        amount: si.sell_price * selectedItems[si.id],
      }));
    recordReturn(sale.id, returnItems, 'cash');
    toast.success(isFullReturn ? 'Full receipt returned & cancelled' : 'Partial return processed');
    setFoundSale(null);
    setReceiptSearch('');
    setSelectedItems({});
    setConfirmReturn(false);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Process Returns" />
      <div className="px-4 py-4 space-y-4">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={receiptSearch} onChange={e => setReceiptSearch(e.target.value)} placeholder="Search by Receipt ID"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground"
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <button onClick={handleSearch} className="px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium">
            Search
          </button>
        </div>

        {sale ? (
          <div className="space-y-3">
            <div className="bg-card rounded-xl p-4">
              <h3 className="font-bold text-foreground">Receipt: {sale.receipt_no}</h3>
              <p className="text-sm text-muted-foreground">{new Date(sale.sold_at).toLocaleString()}</p>
              {sale.status === 'returned' && (
                <span className="text-xs font-bold text-destructive mt-1 inline-block">Already returned</span>
              )}
            </div>

            <p className="text-sm font-medium text-muted-foreground">Select items to return:</p>

            {sItems.map(si => {
              const isSelected = !!selectedItems[si.id];
              const qty = selectedItems[si.id] || 0;
              return (
                <div key={si.id} className={`bg-card rounded-xl p-4 border transition-all ${isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button onClick={() => toggleItem(si.id, si.quantity)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                        {isSelected && <Check size={14} className="text-primary-foreground" />}
                      </button>
                      <div>
                        <h4 className="font-medium text-foreground">{si.item_name}</h4>
                        <p className="text-sm text-muted-foreground">Purchased: {si.quantity} • {formatCurrency(si.sell_price)} each</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(si.id, qty - 1, si.quantity)}
                          className="w-7 h-7 rounded bg-accent text-foreground font-bold text-sm">−</button>
                        <span className="w-6 text-center font-bold text-foreground">{qty}</span>
                        <button onClick={() => updateQty(si.id, qty + 1, si.quantity)}
                          className="w-7 h-7 rounded bg-accent text-foreground font-bold text-sm">+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {Object.keys(selectedItems).length > 0 && (
              <div className="bg-accent rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-foreground font-medium">{isFullReturn ? 'Full Return' : 'Partial Return'}</span>
                  <span className="font-bold text-primary">{formatCurrency(totalRefund)}</span>
                </div>
                <button onClick={() => setConfirmReturn(true)}
                  disabled={sale.status === 'returned'}
                  className="w-full py-3 rounded-xl bg-warning text-warning-foreground font-bold disabled:opacity-50">
                  {isFullReturn ? 'Return Full Receipt' : 'Process Partial Return'}
                </button>
              </div>
            )}
          </div>
        ) : receiptSearch ? (
          <div className="bg-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No receipt found. Try a different ID.</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-8 text-center">
            <QrCode size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Enter a receipt ID to process returns.</p>
          </div>
        )}
      </div>

      <AlertDialog open={confirmReturn} onOpenChange={setConfirmReturn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Return</AlertDialogTitle>
            <AlertDialogDescription>
              {isFullReturn
                ? 'This will cancel the entire receipt and return all items to inventory. This cannot be undone.'
                : `This will return the selected items (refund: ${formatCurrency(totalRefund)}) and update inventory accordingly.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn}>Confirm Return</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
