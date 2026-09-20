import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import FAB from '@/components/FAB';
import { useApp } from '@/context/AppContext';
import { X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api as apiClient } from '@/api';

export default function StockTransfersPage() {
  const { stores, items, currentStore, user, stockTransfers, refreshData, formatCurrency } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [destStoreId, setDestStoreId] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ item_id: string; quantity: number }[]>([]);
  const [addItemId, setAddItemId] = useState('');
  const [addQty, setAddQty] = useState('1');

  const otherStores = stores.filter(s => s.id !== currentStore?.id);

  const handleAddItem = () => {
    if (!addItemId || Number(addQty) <= 0) return;
    const item = items.find(i => i.id === addItemId);
    if (!item) return;
    if (Number(addQty) > item.quantity) {
      toast.error(`Only ${item.quantity} in stock`);
      return;
    }
    if (selectedItems.find(si => si.item_id === addItemId)) {
      setSelectedItems(prev => prev.map(si => si.item_id === addItemId ? { ...si, quantity: si.quantity + Number(addQty) } : si));
    } else {
      setSelectedItems(prev => [...prev, { item_id: addItemId, quantity: Number(addQty) }]);
    }
    setAddItemId('');
    setAddQty('1');
  };

  const handleCreateTransfer = async () => {
    if (!destStoreId) { toast.error('Select destination store'); return; }
    if (selectedItems.length === 0) { toast.error('Add at least one item'); return; }

    const { data: transfer, error } = await apiClient.from('stock_transfers').insert({
      source_store_id: currentStore?.id || '',
      destination_store_id: destStoreId,
      requested_by: user?.id || '',
      status: 'pending',
    } as any).select().single();

    if (error || !transfer) {
      toast.error('Failed to create transfer: ' + (error?.message || 'Unknown error'));
      return;
    }

    const transferItems = selectedItems.map(si => ({
      stock_transfer_id: (transfer as any).id,
      item_id: si.item_id,
      quantity: si.quantity,
    }));

    const { error: itemsError } = await apiClient.from('stock_transfer_items').insert(transferItems as any);
    if (itemsError) {
      toast.error('Failed to add transfer items: ' + itemsError.message);
      return;
    }

    toast.success('Stock transfer created');
    setShowAdd(false);
    setDestStoreId('');
    setSelectedItems([]);
    await refreshData();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Stock Transfers" />
      <div className="px-4 py-4 space-y-4">
        {stores.length <= 1 ? (
          <div className="bg-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">You need at least 2 stores to transfer stock.</p>
            <p className="text-sm text-muted-foreground mt-2">Create another store to get started.</p>
          </div>
        ) : stockTransfers.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No stock transfers yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Tap + to create a transfer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stockTransfers.map(st => {
              const source = stores.find(s => s.id === st.source_store_id);
              const dest = stores.find(s => s.id === st.destination_store_id);
              return (
                <div key={st.id} className="bg-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-foreground">{source?.store_name || 'Unknown'}</span>
                    <ArrowRight size={16} className="text-muted-foreground" />
                    <span className="font-bold text-foreground">{dest?.store_name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{new Date(st.created_at).toLocaleDateString()}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      st.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      st.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      st.status === 'received' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>{st.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Transfer Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end">
          <div className="w-full bg-card rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-foreground">New Stock Transfer</h3>
              <button onClick={() => setShowAdd(false)}><X size={24} className="text-muted-foreground" /></button>
            </div>

            <label className="text-sm font-medium text-foreground">From: {currentStore?.store_name}</label>

            <select value={destStoreId} onChange={e => setDestStoreId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground mt-2 mb-4">
              <option value="">Select Destination Store</option>
              {otherStores.map(s => (
                <option key={s.id} value={s.id}>{s.store_name} - {s.location}</option>
              ))}
            </select>

            {/* Add items */}
            <label className="text-sm font-medium text-foreground">Items to Transfer</label>
            <div className="flex gap-2 mt-2 mb-3">
              <select value={addItemId} onChange={e => setAddItemId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-accent/30 text-foreground text-sm">
                <option value="">Select item</option>
                {items.filter(i => i.type === 'product' && i.quantity > 0).map(i => (
                  <option key={i.id} value={i.id}>{i.name} (qty: {i.quantity})</option>
                ))}
              </select>
              <input type="number" value={addQty} onChange={e => setAddQty(e.target.value)} min="1"
                className="w-16 px-2 py-2 rounded-lg border border-input bg-accent/30 text-foreground text-sm text-center" />
              <button onClick={handleAddItem} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Add</button>
            </div>

            {selectedItems.length > 0 && (
              <div className="bg-accent/30 rounded-lg p-3 mb-4 space-y-2">
                {selectedItems.map(si => {
                  const item = items.find(i => i.id === si.item_id);
                  return (
                    <div key={si.item_id} className="flex justify-between text-sm">
                      <span className="text-foreground">{item?.name || 'Unknown'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">x{si.quantity}</span>
                        <button onClick={() => setSelectedItems(prev => prev.filter(x => x.item_id !== si.item_id))}
                          className="text-destructive"><X size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
              <button onClick={handleCreateTransfer} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Create Transfer</button>
            </div>
          </div>
        </div>
      )}

      <FAB onClick={() => {
        if (stores.length <= 1) {
          toast.error('You need at least 2 stores to transfer stock');
          return;
        }
        setShowAdd(true);
      }} />
    </div>
  );
}
