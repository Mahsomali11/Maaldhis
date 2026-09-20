import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import PageHeader from '@/components/PageHeader';
import { api as apiClient } from '@/api';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface PaymentAccount {
  id: string;
  store_id: string;
  account_name: string;
  account_type: string;
  account_number: string;
  provider_name: string;
  is_active: boolean;
  created_at: string;
}

const ACCOUNT_TYPES = ['Cash', 'Mobile Money', 'Bank', 'Card', 'Digital Wallet'];

export default function PaymentAccountsPage() {
  const { currentStore } = useApp();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    account_name: '',
    account_type: 'Cash',
    account_number: '',
    provider_name: '',
  });

  const fetchAccounts = async () => {
    if (!currentStore) return;
    const { data, error } = await apiClient
      .from('payment_accounts')
      .select('*')
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      if (data.length === 0) {
        // Auto-seed from existing payment methods used in sales
        await seedFromExistingPayments();
        return;
      }
      setAccounts(data);
    }
    setLoading(false);
  };

  const seedFromExistingPayments = async () => {
    if (!currentStore) return;
    // Get distinct payment methods from existing payments
    const { data: existingPayments } = await apiClient
      .from('payments')
      .select('method')
      .eq('store_id', currentStore.id);
    
    const uniqueMethods = new Set<string>();
    existingPayments?.forEach((p) => uniqueMethods.add(p.method));
    
    // Always include Cash as a default
    uniqueMethods.add('cash');
    
    const typeMap: Record<string, string> = {
      cash: 'Cash',
      mpesa: 'Mobile Money',
      card: 'Card',
      bank: 'Bank',
    };

    const toInsert = Array.from(uniqueMethods).map((method) => ({
      store_id: currentStore.id,
      account_name: method === 'mpesa' ? 'M-Pesa' : method.charAt(0).toUpperCase() + method.slice(1),
      account_type: typeMap[method.toLowerCase()] || 'Cash',
      is_active: true,
    }));

    await apiClient.from('payment_accounts').insert(toInsert);
    // Re-fetch after seeding
    const { data } = await apiClient
      .from('payment_accounts')
      .select('*')
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: true });
    if (data) setAccounts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [currentStore?.id]);

  const resetForm = () => {
    setForm({ account_name: '', account_type: 'Cash', account_number: '', provider_name: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!currentStore || !form.account_name.trim()) {
      toast.error('Account name is required');
      return;
    }

    if (editingId) {
      const { error } = await apiClient
        .from('payment_accounts')
        .update({
          account_name: form.account_name.trim(),
          account_type: form.account_type,
          account_number: form.account_number.trim(),
          provider_name: form.provider_name.trim(),
        })
        .eq('id', editingId);
      if (error) {
        toast.error('Failed to update account');
      } else {
        toast.success('Account updated');
      }
    } else {
      const { error } = await apiClient
        .from('payment_accounts')
        .insert({
          store_id: currentStore.id,
          account_name: form.account_name.trim(),
          account_type: form.account_type,
          account_number: form.account_number.trim(),
          provider_name: form.provider_name.trim(),
        });
      if (error) {
        toast.error('Failed to add account');
      } else {
        toast.success('Account added');
      }
    }
    resetForm();
    fetchAccounts();
  };

  const toggleActive = async (account: PaymentAccount) => {
    const { error } = await apiClient
      .from('payment_accounts')
      .update({ is_active: !account.is_active })
      .eq('id', account.id);
    if (!error) {
      toast.success(account.is_active ? 'Account disabled' : 'Account enabled');
      fetchAccounts();
    }
  };

  const deleteAccount = async (account: PaymentAccount) => {
    // Soft-delete by marking inactive instead of removing
    const { error } = await apiClient
      .from('payment_accounts')
      .update({ is_active: false })
      .eq('id', account.id);
    if (!error) {
      toast.success('Account deactivated');
      fetchAccounts();
    }
  };

  const openEdit = (account: PaymentAccount) => {
    setEditingId(account.id);
    setForm({
      account_name: account.account_name,
      account_type: account.account_type,
      account_number: account.account_number,
      provider_name: account.provider_name,
    });
    setShowForm(true);
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'Cash': return 'default';
      case 'Mobile Money': return 'secondary';
      case 'Bank': return 'outline';
      case 'Card': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Payment Accounts" />
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <p className="text-sm text-muted-foreground">
          Manage the payment methods available during sales. Only active accounts appear at checkout.
        </p>

        {/* Add button */}
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium active:scale-[0.98] transition-transform"
        >
          <Plus size={20} />
          Add Payment Account
        </button>

        {/* Form */}
        {showForm && (
          <div className="bg-card rounded-xl p-4 space-y-3 border border-border">
            <h3 className="font-bold text-foreground">{editingId ? 'Edit Account' : 'New Account'}</h3>
            <div>
              <label className="text-sm font-medium text-foreground">Account Name *</label>
              <input
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                placeholder="e.g. Hormuud EVC"
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Account Type</label>
              <select
                value={form.account_type}
                onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Account Number (optional)</label>
              <input
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                placeholder="e.g. 25261XXXXXX"
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Provider Name (optional)</label>
              <input
                value={form.provider_name}
                onChange={(e) => setForm({ ...form, provider_name: e.target.value })}
                placeholder="e.g. Hormuud Telecom"
                className="w-full mt-1 px-4 py-3 rounded-lg border border-input bg-accent/30 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                {editingId ? 'Update' : 'Add Account'}
              </button>
              <button
                onClick={resetForm}
                className="flex-1 py-3 rounded-lg bg-accent text-foreground font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Accounts list */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Wallet size={48} className="mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No payment accounts yet</p>
            <p className="text-sm text-muted-foreground">Add your first payment account above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`bg-card rounded-xl p-4 border transition-colors ${
                  account.is_active ? 'border-border' : 'border-border opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{account.account_name}</h4>
                      <Badge variant={typeColor(account.account_type) as any}>
                        {account.account_type}
                      </Badge>
                      {!account.is_active && (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    {account.account_number && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Account: {account.account_number}
                      </p>
                    )}
                    {account.provider_name && (
                      <p className="text-sm text-muted-foreground">
                        Provider: {account.provider_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={account.is_active}
                      onCheckedChange={() => toggleActive(account)}
                    />
                    <button
                      onClick={() => openEdit(account)}
                      className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => deleteAccount(account)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                      title="Deactivate"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
