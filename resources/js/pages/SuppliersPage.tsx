import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import FAB from '@/components/FAB';
import { Search, Trash2 } from 'lucide-react';
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

export default function SuppliersPage() {
  const { suppliers, addSupplier, deleteSupplier, currentStore } = useApp();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const storeSuppliers = suppliers.filter(s => s.store_id === currentStore?.id);
  const filtered = storeSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search));
  const supplierToDelete = deleteId ? suppliers.find(s => s.id === deleteId) : null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addSupplier({
      store_id: currentStore?.id || '',
      supplier_code: String(suppliers.length + 1).padStart(3, '0'),
      name: form.name,
      phone: form.phone,
      address: form.address,
    });
    toast.success('Supplier added');
    setForm({ name: '', phone: '', address: '' });
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteSupplier(deleteId);
    toast.success('Supplier deleted');
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Suppliers" />
      <div className="px-4 py-4 space-y-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground" />
        </div>

        <div className="bg-card rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 bg-accent p-3 text-xs font-bold text-muted-foreground">
            <span>ID</span><span>Name</span><span>Phone</span><span>Address</span><span></span>
          </div>
          {filtered.map((s, i) => (
            <div key={s.id} className={`grid grid-cols-5 p-3 text-sm border-t border-border items-center ${i % 2 === 0 ? 'bg-card' : 'bg-accent/30'}`}>
              <span className="text-foreground">{s.supplier_code}</span>
              <span className="text-foreground">{s.name}</span>
              <span className="text-foreground">{s.phone || '-'}</span>
              <span className="text-foreground truncate">{s.address || '-'}</span>
              <button onClick={() => setDeleteId(s.id)} className="p-1 justify-self-end">
                <Trash2 size={16} className="text-destructive" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No suppliers found.</p>}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end">
          <div className="w-full bg-card rounded-t-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Add Supplier</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Supplier name"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" required />
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{supplierToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FAB onClick={() => setShowForm(true)} />
    </div>
  );
}
