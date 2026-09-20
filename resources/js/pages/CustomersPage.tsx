import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import FAB from '@/components/FAB';
import { Search, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, currentStore } = useApp();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  const storeCustomers = customers.filter(c => c.store_id === currentStore?.id);
  const filtered = storeCustomers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  const openEdit = (c: typeof customers[0]) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone, address: c.address });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateCustomer(editingId, { name: form.name, phone: form.phone, address: form.address });
      toast.success('Customer updated');
      setEditingId(null);
    } else {
      await addCustomer({
        store_id: currentStore?.id || '',
        customer_code: String(customers.length + 1).padStart(3, '0'),
        name: form.name,
        phone: form.phone,
        address: form.address,
      });
      toast.success('Customer added');
    }
    setForm({ name: '', phone: '', address: '' });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Customers" />
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
          {filtered.map((c, i) => (
            <div key={c.id} className={`grid grid-cols-5 p-3 text-sm border-t border-border items-center ${i % 2 === 0 ? 'bg-card' : 'bg-accent/30'}`}>
              <span className="text-foreground">{c.customer_code}</span>
              <span className="text-foreground">{c.name}</span>
              <span className="text-foreground">{c.phone || '-'}</span>
              <span className="text-foreground truncate">{c.address || '-'}</span>
              <button onClick={() => openEdit(c)} className="p-1 justify-self-end">
                <Pencil size={16} className="text-primary" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No customers found.</p>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-foreground/30 flex items-end">
          <div className="w-full bg-card rounded-t-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-foreground">{editingId ? 'Edit' : 'Add'} Customer</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}><X size={24} className="text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" required />
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address (optional)"
                className="w-full px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold">{editingId ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FAB onClick={() => { setEditingId(null); setForm({ name: '', phone: '', address: '' }); setShowForm(true); }} />
    </div>
  );
}
