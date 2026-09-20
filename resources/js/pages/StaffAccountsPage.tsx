import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import FAB from '@/components/FAB';
import { useApp } from '@/context/AppContext';
import { Trash2, UserPlus, X, Pencil } from 'lucide-react';
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

export default function StaffAccountsPage() {
  const { staffAccounts, addStaffAccount, deleteStaffAccount, updateStaffAccount, currentStore, stores } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'cashier' | 'inventory_manager'>('cashier');
  const [storeId, setStoreId] = useState<string>(currentStore?.id || '');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const storeStaff = staffAccounts.filter(s => s.store_id === currentStore?.id);
  const staffToDelete = deleteId ? staffAccounts.find(s => s.id === deleteId) : null;

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setPassword(''); setRole('cashier'); setStoreId(currentStore?.id || ''); setEditingId(null);
  };

  const openEdit = (staff: typeof staffAccounts[0]) => {
    setEditingId(staff.id);
    setName(staff.full_name);
    setEmail(staff.email);
    setPhone(staff.phone);
    setPassword('');
    setRole(staff.role as typeof role);
    setStoreId(staff.store_id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    try {
      if (editingId) {
        await updateStaffAccount(editingId, {
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          store_id: storeId,
        });
        toast.success('Staff account updated!');
      } else {
        if (!password.trim()) {
          toast.error('Password is required for new staff');
          return;
        }
        await addStaffAccount({
          store_id: storeId || currentStore?.id || '',
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          is_active: true,
          password,
        });
        toast.success('Staff account created!');
      }
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteStaffAccount(deleteId);
    toast.success('Staff account removed');
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Staff Accounts" />
      <div className="px-4 py-4 space-y-4">
        {storeStaff.length === 0 && !showForm ? (
          <div className="text-center py-12">
            <UserPlus size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No staff accounts yet.</p>
            <p className="text-sm text-muted-foreground">Tap + to create your first staff account.</p>
          </div>
        ) : (
          storeStaff.map(staff => (
            <div key={staff.id} className="bg-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-foreground">{staff.full_name}</h4>
                <p className="text-sm text-muted-foreground">{staff.email}</p>
                <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                  staff.role === 'admin' ? 'bg-info/10 text-info' : 
                  staff.role === 'cashier' ? 'bg-success/10 text-success' : 
                  'bg-warning/10 text-warning'
                }`}>
                  {staff.role.replace('_', ' ')}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(staff)} className="p-2 text-primary">
                  <Pencil size={18} />
                </button>
                <button onClick={() => setDeleteId(staff.id)} className="p-2 text-destructive">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}

        <div className="bg-card rounded-xl p-4">
          <h4 className="font-bold text-foreground">Available Roles</h4>
          <div className="mt-3 space-y-2">
            {[
              { name: 'Owner', desc: 'Full access to everything' },
              { name: 'Admin', desc: 'Manage staff, inventory, and reports' },
              { name: 'Cashier', desc: 'Process sales and handle payments' },
              { name: 'Inventory Manager', desc: 'Manage stock and transfers' },
            ].map(r => (
              <div key={r.name} className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                <div>
                  <span className="text-sm font-medium text-foreground">{r.name}</span>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <>
          <div className="fixed inset-0 z-50 bg-foreground/30 animate-fade-in" onClick={() => { setShowForm(false); resetForm(); }} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-card rounded-2xl p-5 shadow-xl max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{editingId ? 'Edit' : 'Create'} Staff Account</h3>
              <button onClick={() => { setShowForm(false); resetForm(); }}><X size={24} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name *"
                className="w-full px-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address *" type="email"
                className="w-full px-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number"
                className="w-full px-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              {!editingId && (
                <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password *" type="password"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground" />
              )}
              <select value={storeId} onChange={e => setStoreId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground">
                <option value="" disabled>Select Store</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.store_name}</option>
                ))}
              </select>
              <select value={role} onChange={e => setRole(e.target.value as typeof role)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-accent/30 text-foreground">
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
                <option value="inventory_manager">Inventory Manager</option>
              </select>
              <button onClick={handleSubmit}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-[0.98] transition-transform">
                {editingId ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{staffToDelete?.full_name}" from staff?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FAB onClick={() => { resetForm(); setShowForm(true); }} />
    </div>
  );
}
