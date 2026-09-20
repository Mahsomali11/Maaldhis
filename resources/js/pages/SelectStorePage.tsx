import { useState } from 'react';
import { router } from '@inertiajs/react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { Store, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SelectStorePage() {
  const { stores, setCurrentStore, deleteStore } = useApp();
  const navigate = (url, options) => router.visit(url, options);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleSelect = (store: typeof stores[0]) => {
    setCurrentStore(store);
    navigate('/dashboard');
  };

  const handleDelete = async (e: React.MouseEvent, storeId: string, storeName: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${storeName}"? This will permanently remove all store data including sales, inventory, and customers.`)) return;
    setDeleting(storeId);
    try {
      const success = await deleteStore(storeId);
      if (success) {
        toast.success(`"${storeName}" deleted successfully`);
        if (stores.length <= 1) navigate('/create-store');
      } else {
        toast.error('Failed to delete store');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete store');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Select Store" showBack={stores.length > 0} />
      <div className="px-4 py-6 space-y-4">
        <p className="text-muted-foreground">Choose a store to continue:</p>
        {stores.map(store => (
          <div key={store.id} className="relative">
            <button onClick={() => handleSelect(store)}
              className="w-full bg-card rounded-xl p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform pr-14">
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                <Store size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{store.store_name}</h3>
                <p className="text-sm text-muted-foreground">{store.location} • ID: {store.store_code}</p>
              </div>
            </button>
            <button
              onClick={(e) => handleDelete(e, store.id, store.store_name)}
              disabled={deleting === store.id}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-50"
              title="Delete store"
            >
              {deleting === store.id ? (
                <div className="w-5 h-5 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={20} />
              )}
            </button>
          </div>
        ))}
        <button onClick={() => navigate('/create-store')}
          className="w-full bg-card rounded-xl p-4 flex items-center gap-3 border-2 border-dashed border-primary/30 active:scale-[0.98] transition-transform">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plus size={24} className="text-primary" />
          </div>
          <span className="font-medium text-primary">Add New Store</span>
        </button>
      </div>
    </div>
  );
}
